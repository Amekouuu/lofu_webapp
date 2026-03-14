import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Post } from '../models/Post';

// GET /api/users/me/posts — get current user's posts
export async function getMyPosts(req: Request, res: Response): Promise<void> {
  try {
    const posts = await Post.find({ author: req.user!._id })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your posts' });
  }
}

// PATCH /api/users/me — update profile (fullName, username, email, avatar)
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, username, email, avatar } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      avatar?: string;
    };

    const userId = req.user!._id;

    // Check username uniqueness if changing
    if (username && username.trim() !== req.user!.username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: userId } });
      if (taken) {
        res.status(409).json({ success: false, message: 'Username is already taken' });
        return;
      }
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase().trim() !== req.user!.email) {
      const taken = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: userId } });
      if (taken) {
        res.status(409).json({ success: false, message: 'Email is already in use' });
        return;
      }
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        ...(fullName  && { fullName: fullName.trim() }),
        ...(username  && { username: username.trim() }),
        ...(email     && { email: email.toLowerCase().trim() }),
        ...(avatar !== undefined && { avatar }),
      },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updated._id,
        fullName: updated.fullName,
        username: updated.username,
        email: updated.email,
        avatar: updated.avatar || '',
        role: updated.role,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

// PATCH /api/users/me/password — change password
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      return;
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
}

// DELETE /api/users/me/posts/:postId — delete own post
export async function deleteMyPost(req: Request, res: Response): Promise<void> {
  try {
    const post = await Post.findOne({ _id: req.params['postId'], author: req.user!._id });

    if (!post) {
      res.status(404).json({ success: false, message: 'Post not found or not yours' });
      return;
    }

    await post.deleteOne();
    res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
}