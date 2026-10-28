import { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { verifyToken } from '../utils/jwt';
import { USER_COLUMNS, UserRow, toUser } from '../db/mappers';
import { isUuid } from '../db/utils';

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

    // Tokens issued before the Supabase migration carry Mongo ObjectIds, not uuids.
    if (!isUuid(decoded.userId)) {
      res.status(401).json({
        success: false,
        message: 'User not found or token is invalid',
      });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error || !data) {
      res.status(401).json({
        success: false,
        message: 'User not found or token is invalid',
      });
      return;
    }

    req.user = toUser(data as unknown as UserRow);
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Unauthorized access',
    });
  }
}
