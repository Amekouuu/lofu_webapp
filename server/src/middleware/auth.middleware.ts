import { NextFunction, Request, Response } from 'express';
import { User } from '../models/User';
import { verifyToken } from '../utils/jwt';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authorization token is missing or invalid',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found or token is invalid',
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Unauthorized access',
    });
  }
}