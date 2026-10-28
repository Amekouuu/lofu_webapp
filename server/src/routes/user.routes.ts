import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { passwordLimiter } from '../middleware/rateLimits';
import { validateBody } from '../validation/validate';
import { changePasswordSchema, privacySchema, updateProfileSchema } from '../validation/schemas';
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
router.patch('/me',                 requireAuth, validateBody(updateProfileSchema), updateProfile);
router.patch('/me/privacy',         requireAuth, validateBody(privacySchema), updatePrivacy);
router.patch('/me/password',        requireAuth, passwordLimiter, validateBody(changePasswordSchema), changePassword);
router.delete('/me/posts/:postId',  requireAuth, deleteMyPost);
router.delete('/me',                requireAuth, deleteAccount);

export default router;