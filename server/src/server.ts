import http from 'http';
import app from './app';
import { env, validateEnv } from './config/env';
import { connectDatabase } from './config/database';
import { initRealtime } from './realtime';

async function startServer(): Promise<void> {
  validateEnv();
  await connectDatabase();

  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Attach Socket.io (authenticated, see realtime.ts)
  initRealtime(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`LoFu API running on http://localhost:${env.port}`);
  });
}

startServer();
