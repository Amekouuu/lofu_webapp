import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { createMessage, isConversationParticipant } from '../db/chat';
import {
  ConversationRow,
  MESSAGE_SELECT,
  MessageRow,
  USER_SUMMARY_COLUMNS,
  toConversation,
  toMessage,
} from '../db/mappers';
import { isUuid } from '../db/utils';

const CONVERSATION_SELECT = [
  'id, post_id, claim_id, last_message, last_message_at, created_at, updated_at',
  'post:posts!post_id(id, item_name, type, images)',
  'latest:messages(sender_id, created_at)',
  `participants:conversation_participants(user:users!user_id(${USER_SUMMARY_COLUMNS}))`,
].join(', ');

// GET /api/conversations — get all conversations for current user
export async function getConversations(req: Request, res: Response): Promise<void> {
  try {
    const { data: mine, error: mineError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', req.user!._id);
    if (mineError) throw mineError;

    const ids = (mine ?? []).map((row) => row.conversation_id as string);

    if (ids.length === 0) {
      res.status(200).json({ success: true, conversations: [] });
      return;
    }

    const { data, error } = await supabase
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .in('id', ids)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      // for the embedded messages: newest first, and only one per conversation
      .order('created_at', { ascending: false, referencedTable: 'messages' })
      .limit(1, { referencedTable: 'messages' });
    if (error) throw error;

    res.status(200).json({
      success: true,
      conversations: ((data ?? []) as unknown as ConversationRow[]).map(toConversation),
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
}

// Checks the conversation exists and the caller is in it. Sends 404/403 and returns
// false otherwise.
async function authorizeConversation(
  conversationId: unknown,
  userId: string,
  res: Response
): Promise<boolean> {
  if (!isUuid(conversationId)) {
    res.status(404).json({ success: false, message: 'Conversation not found' });
    return false;
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    res.status(404).json({ success: false, message: 'Conversation not found' });
    return false;
  }

  if (!(await isConversationParticipant(conversationId, userId))) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return false;
  }

  return true;
}

// GET /api/conversations/:id/messages — get messages in a conversation
export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    if (!(await authorizeConversation(id, req.user!._id, res))) return;

    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    res.status(200).json({
      success: true,
      messages: ((data ?? []) as unknown as MessageRow[]).map(toMessage),
    });
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

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: 'Message content is required' });
      return;
    }

    if (!(await authorizeConversation(id, req.user!._id, res))) return;

    const message = await createMessage(id, req.user!._id, content.trim());

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
}
