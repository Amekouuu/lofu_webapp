import { Request, Response } from 'express';
import { Claim } from '../models/Claim';
import { Post } from '../models/Post';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

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

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (String(post.author) === String(req.user!._id)) {
      res.status(403).json({ success: false, message: 'You cannot claim your own post' });
      return;
    }

    if (post.status === 'Resolved') {
      res.status(400).json({ success: false, message: 'This post is already resolved' });
      return;
    }

    const existing = await Claim.findOne({ post: postId, claimant: req.user!._id });
    if (existing) {
      res.status(409).json({ success: false, message: 'You have already submitted a claim for this item' });
      return;
    }

    const claim = await Claim.create({
      post: postId,
      claimant: req.user!._id,
      message: message.trim(),
      proofDetails: proofDetails.trim(),
      contactInfo: contactInfo?.trim() || '',
    });

    await Post.findByIdAndUpdate(postId, { status: 'Claim Pending' });

    res.status(201).json({ success: true, message: 'Claim submitted successfully', claim });
  } catch (error) {
    console.error('Create claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit claim' });
  }
}

// GET /api/claims/incoming — claims on the current user's posts
export async function getIncomingClaims(req: Request, res: Response): Promise<void> {
  try {
    const myPosts = await Post.find({ author: req.user!._id }).select('_id');
    const postIds = myPosts.map(p => p._id);

    const claims = await Claim.find({ post: { $in: postIds } })
      .populate('post', 'itemName type status images')
      .populate('claimant', 'fullName username avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, claims });
  } catch (error) {
    console.error('Get incoming claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
}

// GET /api/claims/my — claims submitted by current user
export async function getMyClaims(req: Request, res: Response): Promise<void> {
  try {
    const claims = await Claim.find({ claimant: req.user!._id })
      .populate('post', 'itemName type status images landmark')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, claims });
  } catch (error) {
    console.error('Get my claims error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your claims' });
  }
}

// PATCH /api/claims/:claimId/approve — approve a claim (post owner only)
export async function approveClaim(req: Request, res: Response): Promise<void> {
  try {
    const claim = await Claim.findById(req.params['claimId']).populate('post');
    if (!claim) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const post = await Post.findById(claim.post).populate('author', 'fullName');
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (String(post.author._id || post.author) !== String(req.user!._id)) {
      res.status(403).json({ success: false, message: 'Only the post owner can approve claims' });
      return;
    }

    // Approve this claim
    claim.status = 'Approved';
    await claim.save();

    // Reject all other claims for the same post
    await Claim.updateMany(
      { post: post._id, _id: { $ne: claim._id } },
      { status: 'Rejected' }
    );

    // Mark post as Resolved
    post.status = 'Resolved';
    post.approvedClaimId = claim._id as typeof post.approvedClaimId;
    await post.save();

    // Create conversation if it doesn't exist yet
    const existingConvo = await Conversation.findOne({
      post: post._id,
      participants: { $all: [post.author._id || post.author, claim.claimant] },
    });

    let conversation = existingConvo;

    if (!existingConvo) {
      conversation = await Conversation.create({
        participants: [post.author._id || post.author, claim.claimant],
        post: post._id,
        claim: claim._id,
      });
    }

    // Auto-generate opening message from the system
    if (conversation) {
      const autoText = `🎉 Claim approved! "${post.itemName}" has been matched. Please coordinate here to arrange the return. Good luck! 🤝`;

      await Message.create({
        conversation: conversation._id,
        sender: post.author._id || post.author,
        content: autoText,
      });

      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: autoText,
        lastMessageAt: new Date(),
      });
    }

    res.status(200).json({ success: true, message: 'Claim approved and post marked as resolved' });
  } catch (error) {
    console.error('Approve claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve claim' });
  }
}

// PATCH /api/claims/:claimId/reject — reject a claim (post owner only)
export async function rejectClaim(req: Request, res: Response): Promise<void> {
  try {
    const claim = await Claim.findById(req.params['claimId']).populate('post');
    if (!claim) {
      res.status(404).json({ success: false, message: 'Claim not found' });
      return;
    }

    const post = await Post.findById(claim.post);
    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    if (String(post.author) !== String(req.user!._id)) {
      res.status(403).json({ success: false, message: 'Only the post owner can reject claims' });
      return;
    }

    claim.status = 'Rejected';
    await claim.save();

    const pendingCount = await Claim.countDocuments({ post: post._id, status: 'Pending' });
    if (pendingCount === 0 && post.status === 'Claim Pending') {
      await Post.findByIdAndUpdate(post._id, { status: 'Active' });
    }

    res.status(200).json({ success: true, message: 'Claim rejected' });
  } catch (error) {
    console.error('Reject claim error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject claim' });
  }
}