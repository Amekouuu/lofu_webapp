import type { AppUser } from '../db/mappers';

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

export {};
