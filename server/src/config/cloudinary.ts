import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key:    env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

// Uploads one base64 data URL and returns its secure URL. The caller must already have
// validated the string (see validation/schemas.ts); allowed_formats is a second check on
// Cloudinary's side that the bytes really are a supported image.
export async function uploadImage(dataUrl: string, options: UploadApiOptions): Promise<string> {
  const result = await cloudinary.uploader.upload(dataUrl, {
    resource_type: 'image',
    allowed_formats: ['jpg', 'png', 'webp', 'gif'],
    ...options,
  });
  return result.secure_url;
}

// Cloudinary answers a corrupt or unsupported file with HTTP 400. That is the user's file being
// bad, not our server failing, so controllers report it as a 400 instead of a 500.
export function isInvalidImageError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { http_code?: number }).http_code === 400;
}

export { cloudinary };
