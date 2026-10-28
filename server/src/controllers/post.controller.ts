import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { isInvalidImageError, uploadImage } from '../config/cloudinary';
import { PostRow, USER_SUMMARY_COLUMNS, toPost } from '../db/mappers';
import { ilikeAny, isUuid } from '../db/utils';

// Uploads one validated base64 data URL, shrunk to at most 1200x1200. Returns the secure URL.
const uploadPostImage = (dataUrl: string): Promise<string> =>
  uploadImage(dataUrl, {
    folder: 'lofu/posts',
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

const POST_WITH_AUTHOR = `*, author:users!author_id(${USER_SUMMARY_COLUMNS})`;
const SEARCH_COLUMNS = ['item_name', 'description', 'landmark', 'category'];

// Public feed query: everything that isn't resolved, optionally narrowed by type / search.
function feedQuery(
  select: string,
  options: { count?: 'exact'; head?: boolean },
  type?: string,
  search?: string
) {
  let query = supabase.from('posts').select(select, options).neq('status', 'Resolved');

  if (type === 'Lost' || type === 'Found') {
    query = query.eq('type', type);
  }

  if (search?.trim()) {
    query = query.or(ilikeAny(SEARCH_COLUMNS, search.trim()));
  }

  return query;
}

function countByType(type: 'Lost' | 'Found') {
  return supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'Resolved')
    .eq('type', type);
}

// GET /api/posts
// Public — supports ?type=Lost|Found&search=&page=&limit=
export async function getPosts(req: Request, res: Response): Promise<void> {
  try {
    const { type, search, page = '1', limit = '10' } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10) || 10));
    const from     = (pageNum - 1) * limitNum;

    const [postsResult, totalResult, lostResult, foundResult] = await Promise.all([
      feedQuery(POST_WITH_AUTHOR, {}, type, search)
        .order('created_at', { ascending: false })
        .range(from, from + limitNum - 1),
      feedQuery('id', { count: 'exact', head: true }, type, search),
      countByType('Lost'),
      countByType('Found'),
    ]);

    for (const result of [postsResult, totalResult, lostResult, foundResult]) {
      if (result.error) throw result.error;
    }

    const total = totalResult.count ?? 0;

    res.status(200).json({
      success: true,
      posts: ((postsResult.data ?? []) as unknown as PostRow[]).map(toPost),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      counts: { lost: lostResult.count ?? 0, found: foundResult.count ?? 0 },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
}

// GET /api/posts/:id
export async function getPostById(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'];

    if (!isUuid(id)) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const { data, error } = await supabase
      .from('posts')
      .select(POST_WITH_AUTHOR)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    res.status(200).json({ success: true, post: toPost(data as unknown as PostRow) });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
}

// POST /api/posts — create a new post (auth required)
export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    const {
      type, itemName, category, description,
      color, brand, landmark, locationDetails,
      dateLostOrFound, incidentTimeApprox,
      rewardOffered, images,
    } = req.body as {
      type?: string;
      itemName?: string;
      category?: string;
      description?: string;
      color?: string;
      brand?: string;
      landmark?: string;
      locationDetails?: string;
      dateLostOrFound?: string;
      incidentTimeApprox?: string;
      rewardOffered?: string;
      images?: string[];
    };

    if (!type || !itemName || !category || !description || !landmark || !dateLostOrFound) {
      res.status(400).json({
        success: false,
        message: 'type, itemName, category, description, landmark, and dateLostOrFound are required',
      });
      return;
    }

    if (type !== 'Lost' && type !== 'Found') {
      res.status(400).json({ success: false, message: 'type must be Lost or Found' });
      return;
    }

    const eventDate = new Date(dateLostOrFound);
    if (Number.isNaN(eventDate.getTime())) {
      res.status(400).json({ success: false, message: 'dateLostOrFound is not a valid date' });
      return;
    }

    // Upload each base64 image to Cloudinary, get back secure URLs
    let imageUrls: string[] = [];
    if (images && images.length > 0) {
      try {
        imageUrls = await Promise.all(
          images.map(uploadPostImage)
        );
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        if (isInvalidImageError(uploadError)) {
          res.status(400).json({
            success: false,
            message: 'One of your images could not be processed. Please choose a different image.',
          });
          return;
        }
        res.status(500).json({
          success: false,
          message: 'Failed to upload images. Please try again.',
        });
        return;
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id:            req.user!._id,
        type,
        item_name:            itemName.trim(),
        category:             category.trim(),
        description:          description.trim(),
        color:                color?.trim() || '',
        brand:                brand?.trim() || '',
        landmark:             landmark.trim(),
        location_details:     locationDetails?.trim() || '',
        date_lost_or_found:   eventDate.toISOString(),
        incident_time_approx: incidentTimeApprox || null,
        reward_offered:       type === 'Lost' && rewardOffered?.trim()
                                ? rewardOffered.trim()
                                : null,
        images:               imageUrls,
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: toPost(data as unknown as PostRow),
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
}
