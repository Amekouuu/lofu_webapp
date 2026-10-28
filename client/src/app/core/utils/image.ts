// Browser-side image handling for uploads. A photo is decoded and re-drawn on a canvas, which
//  1. shrinks it (a 6 MB phone photo uploads as a few hundred KB), and
//  2. drops EXIF metadata such as GPS coordinates, which matters on a lost-and-found site.

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

/** Returns a user-facing problem with the file, or null when it can be processed. */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported image. Use JPG, PNG, WEBP or GIF.`;
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return `"${file.name}" is too large (max 15 MB).`;
  }

  return null;
}

/** Resizes so the longest side is at most `maxSize` px and returns a JPEG data URL. */
export async function compressImage(
  file: File,
  options: { maxSize: number; quality?: number }
): Promise<string> {
  // Throws for files the browser cannot decode. Orientation from EXIF is applied while decoding.
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, options.maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');

    // JPEG has no transparency: paint white first so transparent PNGs do not turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', options.quality ?? 0.82);
  } finally {
    bitmap.close();
  }
}
