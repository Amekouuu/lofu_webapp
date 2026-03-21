import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Claim } from '../models/Claim';

// GET /api/users/me/posts
export async function getMyPosts(req: Request, res: Response): Promise<void> {
  try {
    const posts = await Post.find({ author: req.user!._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your posts' });
  }
}

// GET /api/users/:id — public profile (respects privacy settings)
export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = await User.findById(req.params['id']).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // If profile is set to private, return limited info
    if (!user.privacySettings?.profileVisible) {
      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          fullName: user.fullName,
          username: user.username,
          avatar: user.avatar || '',
          role: user.role,
          createdAt: user.createdAt,
          isPrivate: true,
        },
        posts: [],
      });
      return;
    }

    const posts = await Post.find({ author: user._id, status: { $ne: 'Resolved' } })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        // Only include email if showEmail is enabled
        email: user.privacySettings?.showEmail ? user.email : null,
        avatar: user.avatar || '',
        role: user.role,
        createdAt: user.createdAt,
        isPrivate: false,
      },
      posts,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

// PATCH /api/users/me
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, username, email, avatar } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      avatar?: string;
    };

    const userId = req.user!._id;

    if (username && username.trim() !== req.user!.username) {
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: userId } });
      if (taken) {
        res.status(409).json({ success: false, message: 'Username is already taken' });
        return;
      }
    }

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
        _id: updated._id,
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

// PATCH /api/users/me/privacy
export async function updatePrivacy(req: Request, res: Response): Promise<void> {
  try {
    const { profileVisible, showEmail } = req.body as {
      profileVisible?: boolean;
      showEmail?: boolean;
    };

    await User.findByIdAndUpdate(req.user!._id, {
      privacySettings: {
        profileVisible: profileVisible ?? true,
        showEmail:      showEmail ?? false,
      },
    });

    res.status(200).json({ success: true, message: 'Privacy settings saved.' });
  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({ success: false, message: 'Failed to save privacy settings' });
  }
}

// PATCH /api/users/me/password
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

// DELETE /api/users/me/posts/:postId
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

// DELETE /api/users/me
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!._id;
    await Post.deleteMany({ author: userId });
    await Claim.deleteMany({ claimant: userId });
    await User.findByIdAndDelete(userId);
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
}