import { Router } from 'express';
import { getPostById, getPosts, createPost } from '../controllers/post.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/',     getPosts);
router.get('/:id',  getPostById);
router.post('/',    requireAuth, createPost);

export default router;