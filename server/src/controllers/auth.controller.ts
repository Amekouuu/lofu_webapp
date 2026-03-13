import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken } from '../utils/jwt';

function sanitizeUser(user: {
  _id: unknown;
  fullName: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user._id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar || '',
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, username, email, password } = req.body as {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    if (!fullName || !username || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Full name, username, email, and password are required',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
      return;
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
      return;
    }

    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        message: 'Username is already taken',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: 'user',
    });

    const token = signToken(String(user._id));

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { emailOrUsername, password } = req.body as {
      emailOrUsername?: string;
      password?: string;
    };

    if (!emailOrUsername || !password) {
      res.status(400).json({
        success: false,
        message: 'Email/username and password are required',
      });
      return;
    }

    const value = emailOrUsername.trim();

    const user = await User.findOne({
      $or: [
        { email: value.toLowerCase() },
        { username: value },
      ],
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const token = signToken(String(user._id));

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log in',
    });
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current user',
    });
  }
}