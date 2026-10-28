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

// Called once at startup. A server that is missing a secret should refuse to start, not run for
// hours and then fail the first person who tries to log in.
export function validateEnv(): void {
  const problems: string[] = [];

  if (!env.jwtSecret) {
    problems.push('JWT_SECRET is not set');
  } else if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (problems.length > 0) {
    throw new Error('Invalid server configuration: ' + problems.join('; '));
  }

  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    console.warn('Cloudinary is not fully configured: uploading photos will fail.');
  }
}