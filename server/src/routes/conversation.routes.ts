import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { messageLimiter } from '../middleware/rateLimits';
import { validateBody } from '../validation/validate';
import { messageSchema } from '../validation/schemas';
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../controllers/conversation.controller';

const router = Router();

router.get('/',           requireAuth, getConversations);
router.get('/:id/messages', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, messageLimiter, validateBody(messageSchema), sendMessage);

export default router;