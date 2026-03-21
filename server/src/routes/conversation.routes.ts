import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../controllers/conversation.controller';

const router = Router();

router.get('/',           requireAuth, getConversations);
router.get('/:id/messages', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, sendMessage);

export default router;