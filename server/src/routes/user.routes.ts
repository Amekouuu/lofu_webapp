import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getMyPosts, updateProfile, changePassword, deleteMyPost } from '../controllers/user.controller';

const router = Router();

router.get('/me/posts',          requireAuth, getMyPosts);
router.patch('/me',              requireAuth, updateProfile);
router.patch('/me/password',     requireAuth, changePassword);
router.delete('/me/posts/:postId', requireAuth, deleteMyPost);

export default router;