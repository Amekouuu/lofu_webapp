import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { isInvalidImageError, uploadImage } from '../config/cloudinary';
import { PostRow, USER_COLUMNS, UserRow, toPost, toUser } from '../db/mappers';
import { isUniqueViolation, isUuid } from '../db/utils';

// GET /api/users/me/posts
export async function getMyPosts(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', req.user!._id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.status(200).json({
      success: true,
      posts: ((data ?? []) as unknown as PostRow[]).map(toPost),
    });
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your posts' });
  }
}

// GET /api/users/:id — public profile (respects privacy settings)
export async function getPublicProfile(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params['id'];

    if (!isUuid(id)) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = toUser(data as unknown as UserRow);

    // If profile is set to private, return limited info
    if (!user.privacySettings.profileVisible) {
      res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          fullName: user.fullName,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
          isPrivate: true,
        },
        posts: [],
      });
      return;
    }

    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', user._id)
      .neq('status', 'Resolved')
      .order('created_at', { ascending: false })
      .limit(10);
    if (postsError) throw postsError;

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        // Only include email if showEmail is enabled
        email: user.privacySettings.showEmail ? user.email : null,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt,
        isPrivate: false,
      },
      posts: ((posts ?? []) as unknown as PostRow[]).map(toPost),
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

function profileResponse(user: ReturnType<typeof toUser>) {
  return {
    _id: user._id,
    id: user._id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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
    const usernameValue = username?.trim();
    const emailValue = email?.toLowerCase().trim();

    if (usernameValue && usernameValue !== req.user!.username) {
      const { data: taken, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', usernameValue)
        .neq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (taken) {
        res.status(409).json({ success: false, message: 'Username is already taken' });
        return;
      }
    }

    if (emailValue && emailValue !== req.user!.email) {
      const { data: taken, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', emailValue)
        .neq('id', userId)
        .maybeSingle();
      if (error) throw error;
      if (taken) {
        res.status(409).json({ success: false, message: 'Email is already in use' });
        return;
      }
    }

    const updates: Record<string, string> = {};
    if (fullName?.trim()) updates['full_name'] = fullName.trim();
    if (usernameValue)    updates['username']  = usernameValue;
    if (emailValue)       updates['email']     = emailValue;
    // Avatars live in Cloudinary; the database only stores the URL (or '' to remove it).
    if (avatar !== undefined) {
      try {
        updates['avatar'] = avatar === ''
          ? ''
          : await uploadImage(avatar, {
              folder: 'lofu/avatars',
              transformation: [
                { width: 256, height: 256, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' },
              ],
            });
      } catch (uploadError) {
        console.error('Avatar upload error:', uploadError);
        if (isInvalidImageError(uploadError)) {
          res.status(400).json({
            success: false,
            message: 'That image could not be processed. Please choose a different one.',
          });
          return;
        }
        res.status(500).json({ success: false, message: 'Failed to upload avatar. Please try again.' });
        return;
      }
    }

    let updated = req.user!;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select(USER_COLUMNS)
        .maybeSingle();

      if (isUniqueViolation(error)) {
        res.status(409).json({ success: false, message: 'Username or email is already in use' });
        return;
      }
      if (error) throw error;

      if (!data) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      updated = toUser(data as unknown as UserRow);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: profileResponse(updated),
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

    const { error } = await supabase
      .from('users')
      .update({
        profile_visible: profileVisible ?? true,
        show_email:      showEmail ?? false,
      })
      .eq('id', req.user!._id);
    if (error) throw error;

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

    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user!._id)
      .maybeSingle();
    if (error) throw error;

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash as string);
    if (!matches) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: await bcrypt.hash(newPassword, 10) })
      .eq('id', req.user!._id);
    if (updateError) throw updateError;

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
}

// DELETE /api/users/me/posts/:postId
export async function deleteMyPost(req: Request, res: Response): Promise<void> {
  try {
    const postId = req.params['postId'];

    if (!isUuid(postId)) {
      res.status(404).json({ success: false, message: 'Post not found or not yours' });
      return;
    }

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', req.user!._id)
      .select('id');
    if (error) throw error;

    if (!data || data.length === 0) {
      res.status(404).json({ success: false, message: 'Post not found or not yours' });
      return;
    }

    res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
}

// DELETE /api/users/me
// Foreign keys cascade: the user's posts, their claims, and their conversation
// memberships go with the account (see schema.sql).
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.user!._id);
    if (error) throw error;

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
}
