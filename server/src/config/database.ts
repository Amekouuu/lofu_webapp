import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is missing in .env');
  }

  try {
    await mongoose.connect(env.mongoUri);
    console.log('MongoDB Atlas connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}