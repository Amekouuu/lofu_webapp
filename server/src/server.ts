import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';

async function startServer(): Promise<void> {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`LoFu API running on http://localhost:${env.port}`);
  });
}

startServer();