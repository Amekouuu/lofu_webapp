import { Router } from 'express';
import { getPostById, getPosts, createPost } from '../controllers/post.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { createPostLimiter } from '../middleware/rateLimits';
import { validateBody } from '../validation/validate';
import { createPostSchema } from '../validation/schemas';

const router = Router();

router.get('/',     getPosts);
router.get('/:id',  getPostById);
router.post('/',    requireAuth, createPostLimiter, validateBody(createPostSchema), createPost);

export default router;