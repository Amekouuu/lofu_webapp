import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getMyPosts,
  getPublicProfile,
  updateProfile,
  updatePrivacy,
  changePassword,
  deleteMyPost,
  deleteAccount,
} from '../controllers/user.controller';

const router = Router();

router.get('/me/posts',             requireAuth, getMyPosts);
router.get('/:id',                              getPublicProfile);
router.patch('/me',                 requireAuth, updateProfile);
router.patch('/me/privacy',         requireAuth, updatePrivacy);
router.patch('/me/password',        requireAuth, changePassword);
router.delete('/me/posts/:postId',  requireAuth, deleteMyPost);
router.delete('/me',                requireAuth, deleteAccount);

export default router;