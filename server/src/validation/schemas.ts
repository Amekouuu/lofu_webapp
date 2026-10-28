import { z } from 'zod';
import { isUuid } from '../db/utils';

// These are the server-side rules. The Angular forms have their own client-side checks for
// quick feedback, but anyone can call the API directly, so these are the ones that count.
// Unknown fields are dropped (z.object strips them), which also blocks mass-assignment.

// Mirror the lists in client/src/app/features/posts/post-item/post-item.ts
export const CATEGORIES = [
  'Electronics', 'Bags & Wallets', 'Clothing & Accessories',
  'Keys', 'Documents & IDs', 'Jewelry', 'Toys & Collectibles',
  'Books & School Supplies', 'Sports Equipment', 'Pets', 'Others',
] as const;

export const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

export const MAX_POST_IMAGES = 4;

// Base64 text is ~4/3 the size of the file: 7M chars is about a 5 MB photo,
// 3.5M chars is about a 2.5 MB avatar.
const MAX_POST_IMAGE_CHARS = 7_000_000;
const MAX_AVATAR_CHARS = 3_500_000;

// Only inline base64 images are accepted. A plain https:// string would make Cloudinary
// fetch an arbitrary remote URL on our behalf.
const DATA_URL_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const required = (label: string) => ({ error: `${label} is required.` });

function text(label: string, max: number, min = 1) {
  return z
    .string(required(label))
    .trim()
    .min(min, {
      error: min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`,
    })
    .max(max, { error: `${label} must be at most ${max} characters.` });
}

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: `${label} must be at most ${max} characters.` })
    .optional();
}

function imageDataUrl(maxChars: number, tooLarge: string) {
  return z
    .string({ error: 'Image data is invalid.' })
    .max(maxChars, { error: tooLarge })
    .regex(DATA_URL_IMAGE, { error: 'Images must be PNG, JPG, WEBP or GIF files.' });
}

// ── credentials ────────────────────────────────────────────────────────
const username = z
  .string(required('Username'))
  .trim()
  .regex(/^[A-Za-z0-9_]{3,30}$/, {
    error: 'Username must be 3-30 characters: letters, numbers and underscores only.',
  });

const email = z
  .string(required('Email'))
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: 'Please enter a valid email address.' })
      .max(254, { error: 'Email is too long.' })
  );

// bcrypt only looks at the first 72 bytes, so longer passwords add nothing.
const password = z
  .string(required('Password'))
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must be at most 72 characters.' });

export const registerSchema = z.object({
  fullName: text('Full name', 100, 2),
  username,
  email,
  password,
});

export const loginSchema = z.object({
  emailOrUsername: text('Email or username', 254),
  // No minimum here: accounts made under the old 6-character rule must still be able to log in.
  password: z
    .string(required('Password'))
    .min(1, { error: 'Password is required.' })
    .max(128, { error: 'Password is too long.' }),
});

// ── posts ──────────────────────────────────────────────────────────────
const eventDate = z
  .string(required('Date'))
  .refine((value) => !Number.isNaN(Date.parse(value)), { error: 'Date is not valid.', abort: true })
  // one day of slack so a user ahead of UTC can still pick "today"
  .refine((value) => Date.parse(value) <= Date.now() + MS_PER_DAY, {
    error: 'Date cannot be in the future.',
  });

export const createPostSchema = z.object({
  type: z.enum(['Lost', 'Found'], { error: 'Type must be Lost or Found.' }),
  itemName: text('Item name', 100),
  category: z.enum(CATEGORIES, { error: 'Please choose a valid category.' }),
  description: text('Description', 500),
  color: optionalText('Color', 50),
  brand: optionalText('Brand', 50),
  landmark: text('Landmark', 100),
  locationDetails: optionalText('Location details', 200),
  dateLostOrFound: eventDate,
  incidentTimeApprox: z
    .union([z.enum(TIME_OPTIONS), z.literal('')], { error: 'Please choose a valid time of day.' })
    .optional(),
  rewardOffered: optionalText('Reward', 100),
  images: z
    .array(imageDataUrl(MAX_POST_IMAGE_CHARS, 'Each image must be under 5 MB.'), {
      error: 'Images must be a list.',
    })
    .max(MAX_POST_IMAGES, { error: `You can upload up to ${MAX_POST_IMAGES} images.` })
    .default([]),
});

// ── claims & chat ──────────────────────────────────────────────────────
export const createClaimSchema = z.object({
  postId: z.string(required('Post')).refine(isUuid, { error: 'Invalid post.' }),
  message: text('Message', 1000),
  proofDetails: text('Proof details', 1000),
  contactInfo: optionalText('Contact info', 200),
});

export const messageSchema = z.object({
  content: text('Message', 2000),
});

// ── account ────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  fullName: text('Full name', 100, 2).optional(),
  username: username.optional(),
  email: email.optional(),
  // Required only when the email actually changes (checked in the controller)
  currentPassword: z.string().max(128, { error: 'Current password is too long.' }).optional(),
  // '' removes the avatar; otherwise a base64 image that the server uploads to Cloudinary.
  avatar: z
    .union([z.literal(''), imageDataUrl(MAX_AVATAR_CHARS, 'Avatar image is too large (max 2 MB).')])
    .optional(),
});

export const privacySchema = z.object({
  profileVisible: z.boolean({ error: 'profileVisible must be true or false.' }).optional(),
  showEmail: z.boolean({ error: 'showEmail must be true or false.' }).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string(required('Current password'))
    .min(1, { error: 'Current password is required.' })
    .max(128, { error: 'Current password is too long.' }),
  newPassword: password,
});
