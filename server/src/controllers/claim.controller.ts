import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { createMessage } from '../db/chat';
import { ClaimRow, USER_SUMMARY_COLUMNS, toClaim } from '../db/mappers';
import { isUniqueViolation, isUuid } from '../db/utils';

// The `!post_id` / `!claimant_id` hints pick the exact foreign key, because posts and
// claims also reference each other through posts.approved_claim_id.
const CLAIM_WITH_RELATIONS = (postColumns: string) =>
  `*, post:posts!post_id(${postColumns}), claimant:users!claimant_id(${USER_SUMMARY_COLUMNS})`;

// POST /api/claims — submit a claim on a post
export async function createClaim(req: Request, res: Response): Promise<void> {
  try {
    const { postId, message, proofDetails, contactInfo } = req.body as {
      postId?: string;
      message?: string;
      proofDetails?: string;
      contactInfo?: string;
    };

    if (!postId || !message || !proofDetails) {
      res.status(400).json({ success: false, message: 'postId, message, and proofDetails are required' });
      return;
    }

    if (!isUuid(postId)) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, author_id, status')
      .eq('id', postId)
      .maybeSingle();
    if (postError) throw postError;

    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (post.author_id === req.user!._id) {
      res.status(403).json({ success: false, message: 'You cannot claim your own post' });
      return;
    }

    if (post.status === 'Resolved') {
      res.status(400).json({ success: false, message: 'This post is already resolved' });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('claims')
      .select('id')
      .eq('post_id', postId)
      .eq('claimant_id', req.user!._id)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      res.status(409).json({ success: false, message: 'You have already submitted a claim for this item' });
      return;
    }

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .insert({
        post_id: postId,
        claimant_id: req.user!._id,
        message: message.trim(),
        proof_details: proofDetails.trim(),
        contact_info: contactInfo?.trim() || '',
      })
      .select('*')
      .single();

    // unique (post_id, claimant_id) caught a duplicate submitted at the same moment
    if (isUniqueViolation(claimError)) {
      res.status(409).json({ success: false, message: 'You have already submitted a claim for this item' });
      return;
    }
    if (claimError) throw claimError;

    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'Claim Pending' })
      .eq('id', postId);
    if (updateError) throw updateError;

    res.status(201).json({
      success: true,
      message: 'Claim submitted successfully',
      claim: toClaim(claim as unknown as ClaimRow),
    });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit claim' });
  }
}

// GET /api/claims/incoming — claims on the current user's posts
export async function getIncomingClaims(req: Request, res: Response): Promise<void> {
  try {
    const { data: myPosts, error: postsError } = await supabase
      .from('posts')
      .select('id')
      .eq('author_id', req.user!._id);
    if (postsError) throw postsError;

    const postIds = (myPosts ?? []).map((p) => p.id as string);

    if (postIds.length === 0) {
      res.status(200).json({ success: true, claims: [] });
      return;
    }

    const { data, error } = await supabase
      .from('claims')
      .select(CLAIM_WITH_RELATIONS('id, item_name, type, status, images'))
      .in('post_id', postIds)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json({
      success: true,
      claims: ((data ?? []) as unknown as ClaimRow[]).map(toClaim),
    });
  } catch (error) {
    console.error('Get incoming claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
}

// GET /api/claims/my — claims submitted by current user
export async function getMyClaims(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('claims')
      .select(`*, post:posts!post_id(id, item_name, type, status, images, landmark)`)
      .eq('claimant_id', req.user!._id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json({
      success: true,
      claims: ((data ?? []) as unknown as ClaimRow[]).map(toClaim),
    });
  } catch (error) {
    console.error('Get my claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your claims' });
  }
}

// Loads a claim plus its post, or sends the 404 and returns null.
async function loadClaimWithPost(claimId: unknown, res: Response) {
  if (!isUuid(claimId)) {
    res.status(404).json({ success: false, message: 'Claim not found' });
    return null;
  }

  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('id, post_id, claimant_id')
    .eq('id', claimId)
    .maybeSingle();
  if (claimError) throw claimError;

  if (!claim) {
    res.status(404).json({ success: false, message: 'Claim not found' });
    return null;
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id, item_name, status')
    .eq('id', claim.post_id)
    .maybeSingle();
  if (postError) throw postError;

  if (!post) {
    res.status(404).json({ success: false, message: 'Post not found' });
    return null;
  }

  return { claim, post };
}

// PATCH /api/claims/:claimId/approve — approve a claim (post owner only)
export async function approveClaim(req: Request, res: Response): Promise<void> {
  try {
    const loaded = await loadClaimWithPost(req.params['claimId'], res);
    if (!loaded) return;
    const { claim, post } = loaded;

    if (post.author_id !== req.user!._id) {
      res.status(403).json({ success: false, message: 'Only the post owner can approve claims' });
      return;
    }

    // Approve this claim
    const { error: approveError } = await supabase
      .from('claims')
      .update({ status: 'Approved' })
      .eq('id', claim.id);
    if (approveError) throw approveError;

    // Reject all other claims for the same post
    const { error: rejectError } = await supabase
      .from('claims')
      .update({ status: 'Rejected' })
      .eq('post_id', post.id)
      .neq('id', claim.id);
    if (rejectError) throw rejectError;

    // Mark post as Resolved
    const { error: resolveError } = await supabase
      .from('posts')
      .update({ status: 'Resolved', approved_claim_id: claim.id })
      .eq('id', post.id);
    if (resolveError) throw resolveError;

    // Create conversation if it doesn't exist yet
    const { data: convos, error: convosError } = await supabase
      .from('conversations')
      .select('id, participants:conversation_participants(user_id)')
      .eq('post_id', post.id);
    if (convosError) throw convosError;

    const existing = (convos ?? []).find((c) => {
      const ids = (c.participants as { user_id: string }[]).map((p) => p.user_id);
      return ids.includes(post.author_id) && ids.includes(claim.claimant_id);
    });

    let conversationId: string;

    if (existing) {
      conversationId = existing.id as string;
    } else {
      const { data: created, error: createError } = await supabase
        .from('conversations')
        .insert({ post_id: post.id, claim_id: claim.id })
        .select('id')
        .single();
      if (createError) throw createError;

      conversationId = created.id as string;

      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversationId, user_id: post.author_id },
          { conversation_id: conversationId, user_id: claim.claimant_id },
        ]);
      if (participantsError) throw participantsError;
    }

    // Auto-generate opening message from the post owner
    const autoText = `🎉 Claim approved! "${post.item_name}" has been matched. Please coordinate here to arrange the return. Good luck! 🤝`;
    await createMessage(conversationId, post.author_id, autoText);

    res.status(200).json({ success: true, message: 'Claim approved and post marked as resolved' });
  } catch (error) {
    console.error('Approve claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve claim' });
  }
}

// PATCH /api/claims/:claimId/reject — reject a claim (post owner only)
export async function rejectClaim(req: Request, res: Response): Promise<void> {
  try {
    const loaded = await loadClaimWithPost(req.params['claimId'], res);
    if (!loaded) return;
    const { claim, post } = loaded;

    if (post.author_id !== req.user!._id) {
      res.status(403).json({ success: false, message: 'Only the post owner can reject claims' });
      return;
    }

    const { error: rejectError } = await supabase
      .from('claims')
      .update({ status: 'Rejected' })
      .eq('id', claim.id);
    if (rejectError) throw rejectError;

    const { count, error: countError } = await supabase
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .eq('status', 'Pending');
    if (countError) throw countError;

    if ((count ?? 0) === 0 && post.status === 'Claim Pending') {
      const { error: reopenError } = await supabase
        .from('posts')
        .update({ status: 'Active' })
        .eq('id', post.id);
      if (reopenError) throw reopenError;
    }

    res.status(200).json({ success: true, message: 'Claim rejected' });
  } catch (error) {
    console.error('Reject claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject claim' });
  }
}
