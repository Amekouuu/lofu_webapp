import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

// GET /api/conversations — get all conversations for current user
export async function getConversations(req: Request, res: Response): Promise<void> {
  try {
    const conversations = await Conversation.find({
      participants: req.user!._id,
    })
      .populate('participants', 'fullName username avatar')
      .populate('post', 'itemName type images')
      .sort({ lastMessageAt: -1, createdAt: -1 });

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
}

// GET /api/conversations/:id/messages — get messages in a conversation
export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);
    const conversationId = new Types.ObjectId(id);

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants
      .map((p) => String(p))
      .includes(String(req.user!._id));

    if (!isParticipant) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'fullName username avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
}

// POST /api/conversations/:id/messages — send a message (REST fallback)
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { content } = req.body as { content?: string };
    const id = String(req.params['id']);
    const conversationId = new Types.ObjectId(id);

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: 'Message content is required' });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const isParticipant = conversation.participants
      .map((p) => String(p))
      .includes(String(req.user!._id));

    if (!isParticipant) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const created = await Message.create({
      conversation: conversationId,
      sender: req.user!._id,
      content: content.trim(),
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: content.trim(),
      lastMessageAt: new Date(),
    });

    const populated = await Message.findById(created._id)
      .populate('sender', 'fullName username avatar');

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}