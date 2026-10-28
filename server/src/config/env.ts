import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port:                Number(process.env.PORT) || 5000,
  nodeEnv:             process.env.NODE_ENV || 'development',
  clientUrl:           process.env.CLIENT_URL || 'http://localhost:4200',
  trustProxy:          Number(process.env.TRUST_PROXY ?? '1'),
  supabaseUrl:            process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret:           process.env.JWT_SECRET || '',
  jwtExpiresIn:        process.env.JWT_EXPIRES_IN || '7d',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey:    process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};