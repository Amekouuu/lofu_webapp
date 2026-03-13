import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayloadShape {
  userId: string;
}

export function signToken(userId: string): string {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is missing in .env');
  }

  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayloadShape {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is missing in .env');
  }

  const decoded = jwt.verify(token, env.jwtSecret) as JwtPayloadShape;
  return decoded;
}