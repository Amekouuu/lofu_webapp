import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port:                Number(process.env.PORT) || 5000,
  nodeEnv:             process.env.NODE_ENV || 'development',
  clientUrl:           process.env.CLIENT_URL || 'http://localhost:4200',
  mongoUri:            process.env.MONGODB_URI || '',
  jwtSecret:           process.env.JWT_SECRET || '',
  jwtExpiresIn:        process.env.JWT_EXPIRES_IN || '7d',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey:    process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};