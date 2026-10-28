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

// Only images this app uploaded: https://res.cloudinary.com/<cloud>/image/upload/[v123/]lofu/posts|avatars/<id>.<ext>
const OWN_IMAGE_URL =
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)*?(lofu\/(?:posts|avatars)\/[A-Za-z0-9_-]+)\.[A-Za-z0-9]+$/;

/** "https://res.cloudinary.com/x/image/upload/v1/lofu/posts/abc.jpg" -> "lofu/posts/abc" (or null). */
export function publicIdFromUrl(url: string): string | null {
  const match = OWN_IMAGE_URL.exec(url);
  return match ? match[1] : null;
}

// Deletes uploaded images that no post or profile uses any more. Best effort: by the time this
// runs the database change has already succeeded, so a Cloudinary hiccup is logged, not thrown.
export async function deleteImages(urls: Array<string | null | undefined>): Promise<void> {
  const publicIds = urls
    .filter((url): url is string => typeof url === 'string')
    .map(publicIdFromUrl)
    .filter((id): id is string => id !== null);

  if (publicIds.length === 0) return;

  try {
    // invalidate: also purge the copies cached on Cloudinary's CDN, so a deleted photo really disappears
    await cloudinary.api.delete_resources(publicIds, { invalidate: true });
  } catch (error) {
    console.error('Cloudinary cleanup failed (images left behind):', error);
  }
}

export { cloudinary };
