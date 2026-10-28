import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './config/env';
import { supabase } from './config/supabase';
import { isConversationParticipant } from './db/chat';
import { isUuid } from './db/utils';
import { verifyToken } from './utils/jwt';

// Live chat. Sockets never write anything: messages are saved through the REST endpoint (with its
// validation and rate limit) and this module only announces them. Every socket must present a valid
// login token when it connects, and the user it belongs to comes from that token, never from the
// payload of an event.
let io: SocketServer | null = null;

const userRoom = (userId: string) => `user:${userId}`;
const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;

export function initRealtime(httpServer: http.Server): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      // In development, accept the client from any localhost port (ng serve, previews).
      origin: [
        env.clientUrl,
        ...(env.nodeEnv === 'development' ? [/^http:\/\/localhost:\d+$/] : []),
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.['token'];
      if (typeof token !== 'string' || !token) throw new Error('missing token');

      const { userId } = verifyToken(token);
      if (!isUuid(userId)) throw new Error('bad token');

      const { data, error } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
      if (error || !data) throw new Error('unknown user');

      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('invalid_session'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(userRoom(userId));

    // Only conversations the user belongs to can be listened to. The callback tells the client
    // whether it worked so it can fall back to polling.
    socket.on('join_conversation', async (conversationId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (!isUuid(conversationId) || !(await isConversationParticipant(conversationId, userId))) {
          ack?.(false);
          return;
        }
        await socket.join(conversationRoom(conversationId));
        ack?.(true);
      } catch (error) {
        console.error('Socket join_conversation error:', error);
        ack?.(false);
      }
    });

    socket.on('leave_conversation', (conversationId: unknown) => {
      if (isUuid(conversationId)) void socket.leave(conversationRoom(conversationId));
    });
  });

  return io;
}

// A message was saved: show it to everyone looking at that conversation, and tell each
// participant so their conversation list and unread badge refresh.
export function publishMessage(conversationId: string, message: unknown, participantIds: string[]): void {
  if (!io) return;
  io.to(conversationRoom(conversationId)).emit('new_message', { conversationId, message });
  notifyUsers(participantIds);
}

// Something about these users' conversation lists changed (for example a claim was approved and a
// chat was created).
export function notifyUsers(userIds: string[]): void {
  if (!io) return;
  for (const userId of userIds) io.to(userRoom(userId)).emit('conversations_changed');
}
