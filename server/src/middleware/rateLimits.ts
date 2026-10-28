import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
  // Count per logged-in account instead of per IP. Needs requireAuth to run first.
  perUser?: boolean;
  // Only failed requests (status >= 400) count, e.g. wrong passwords.
  skipSuccessfulRequests?: boolean;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function limiter({ windowMs, limit, message, perUser = false, skipSuccessfulRequests = false }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Per-account keys stop people sharing one campus / Wi-Fi IP from blocking each other.
    keyGenerator: (req: Request) =>
      perUser && req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip ?? ''),
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

// Broad safety net for the whole API. Generous on purpose: chat polling alone is ~300 requests
// per 15 minutes per open tab, and many users can share one IP.
export const apiLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 3000,
  message: 'Too many requests. Please slow down and try again in a few minutes.',
});

export const loginLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Please try again in 15 minutes.',
});

export const registerLimiter = limiter({
  windowMs: HOUR,
  limit: 10,
  message: 'Too many accounts created from this network. Please try again later.',
});

// Guessing the current password with a stolen token
export const passwordLimiter = limiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  perUser: true,
  skipSuccessfulRequests: true,
  message: 'Too many failed attempts. Please try again in 15 minutes.',
});

export const createPostLimiter = limiter({
  windowMs: HOUR,
  limit: 30,
  perUser: true,
  message: 'You are posting too quickly. Please try again later.',
});

export const claimLimiter = limiter({
  windowMs: HOUR,
  limit: 30,
  perUser: true,
  message: 'You are submitting claims too quickly. Please try again later.',
});

export const messageLimiter = limiter({
  windowMs: MINUTE,
  limit: 30,
  perUser: true,
  message: 'You are sending messages too quickly. Please wait a moment.',
});
