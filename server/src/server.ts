import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { Message } from './models/Message';
import { Conversation } from './models/Conversation';

async function startServer(): Promise<void> {
  await connectDatabase();

  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Attach Socket.io
  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.clientUrl,
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
      senderName: string;
      senderAvatar?: string;
    }) => {
      try {
        const message = await Message.create({
          conversation: data.conversationId,
          sender: data.senderId,
          content: data.content.trim(),
        });

        // Update last message preview
        await Conversation.findByIdAndUpdate(data.conversationId, {
          lastMessage: data.content.trim(),
          lastMessageAt: new Date(),
        });

        // Broadcast to all users in the conversation room
        io.to(data.conversationId).emit('new_message', {
          _id: message._id,
          conversation: data.conversationId,
          sender: {
            _id: data.senderId,
            fullName: data.senderName,
            avatar: data.senderAvatar || '',
          },
          content: data.content.trim(),
          createdAt: message.createdAt,
        });
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