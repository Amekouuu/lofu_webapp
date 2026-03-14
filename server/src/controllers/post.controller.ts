import { Request, Response } from 'express';
import { Post } from '../models/Post';

// GET /api/posts
// Public — supports ?type=Lost|Found&search=&page=&limit=
export async function getPosts(req: Request, res: Response): Promise<void> {
  try {
    const { type, search, page = '1', limit = '10' } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { status: { $ne: 'Resolved' } };

    if (type === 'Lost' || type === 'Found') {
      filter['type'] = type;
    }

    if (search?.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter['$or'] = [
        { itemName: regex },
        { description: regex },
        { landmark: regex },
        { category: regex },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const [posts, total, lostCount, foundCount] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'fullName username avatar'),
      Post.countDocuments(filter),
      Post.countDocuments({ status: { $ne: 'Resolved' }, type: 'Lost' }),
      Post.countDocuments({ status: { $ne: 'Resolved' }, type: 'Found' }),
    ]);

    res.status(200).json({
      success: true,
      posts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      counts: { lost: lostCount, found: foundCount },
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
}

// GET /api/posts/:id
export async function getPostById(req: Request, res: Response): Promise<void> {
  try {
    const post = await Post.findById(req.params['id'])
      .populate('author', 'fullName username avatar');

    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    res.status(200).json({ success: true, post });
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
      dateLostOrFound, incidentTimeApprox, images,
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

    const post = await Post.create({
      author: req.user!._id,
      type,
      itemName: itemName.trim(),
      category: category.trim(),
      description: description.trim(),
      color: color?.trim() || '',
      brand: brand?.trim() || '',
      landmark: landmark.trim(),
      locationDetails: locationDetails?.trim() || '',
      dateLostOrFound: new Date(dateLostOrFound),
      incidentTimeApprox: incidentTimeApprox || undefined,
      images: images || [],
    });

    res.status(201).json({ success: true, message: 'Post created successfully', post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
}