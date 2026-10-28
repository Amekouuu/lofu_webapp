import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { createMessage, isConversationParticipant } from './db/chat';
import { isUuid } from './db/utils';

async function startServer(): Promise<void> {
  await connectDatabase();

  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Attach Socket.io
  const io = new SocketServer(httpServer, {
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

  io.on('connection', (socket) => {
    // User joins their conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
    });

    // User leaves a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    // User sends a message
    socket.on('send_message', async (data: {
      conversationId: string;
      senderId: string;
      content: string;
      senderName?: string;
      senderAvatar?: string;
    }) => {
      try {
        const content = data.content?.trim();

        if (!isUuid(data.conversationId) || !isUuid(data.senderId) || !content) {
          socket.emit('message_error', { error: 'Failed to send message' });
          return;
        }

        if (!(await isConversationParticipant(data.conversationId, data.senderId))) {
          socket.emit('message_error', { error: 'Failed to send message' });
          return;
        }

        // Sender name/avatar now come from the database, not from the client payload.
        const message = await createMessage(data.conversationId, data.senderId, content);

        // Broadcast to all users in the conversation room
        io.to(data.conversationId).emit('new_message', message);
      } catch (error) {
        console.error('Socket send_message error:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    });
  });

  httpServer.listen(env.port, () => {
    console.log(`LoFu API running on http://localhost:${env.port}`);
  });
}

startServer();
