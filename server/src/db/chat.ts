import { supabase } from '../config/supabase';
import { MESSAGE_SELECT, MessageRow, toMessage } from './mappers';

export async function isConversationParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function getParticipantIds(conversationId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);

  if (error) throw error;
  return (data ?? []).map((row) => row.user_id as string);
}

// Shared by the REST endpoint and claim approval:
// inserts the message and refreshes the conversation's "last message" preview.
export async function createMessage(conversationId: string, senderId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content })
    .select(MESSAGE_SELECT)
    .single();

  if (error) throw error;

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) throw updateError;

  return toMessage(data as unknown as MessageRow);
}
