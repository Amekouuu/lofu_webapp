import { Router } from 'express';
import { getCurrentUser, login, register } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loginLimiter, registerLimiter } from '../middleware/rateLimits';
import { validateBody } from '../validation/validate';
import { loginSchema, registerSchema } from '../validation/schemas';

const router = Router();

router.post('/register', registerLimiter, validateBody(registerSchema), register);
router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.get('/me', requireAuth, getCurrentUser);

export default router;