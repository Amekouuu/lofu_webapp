import { Router } from 'express';
import authRoutes  from './auth.routes';
import postRoutes  from './post.routes';
import userRoutes  from './user.routes';
import claimRoutes from './claim.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'LoFu API is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth',   authRoutes);
router.use('/posts',  postRoutes);
router.use('/users',  userRoutes);
router.use('/claims', claimRoutes);

export default router;