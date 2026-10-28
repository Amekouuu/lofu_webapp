import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase';
import { signToken } from '../utils/jwt';
import { AppUser, USER_COLUMNS, UserRow, toUser } from '../db/mappers';
import { isUniqueViolation, likeLiteral } from '../db/utils';

type UserWithHash = UserRow & { password_hash: string };

function sanitizeUser(user: AppUser) {
  return {
    // Both spellings: the client's User type (and the chat code) reads _id, other code reads id.
    _id: user._id,
    id: user._id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatar: user.avatar || '',
    role: user.role,
    privacySettings: user.privacySettings,
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

    const fullNameValue = fullName.trim();
    const usernameValue = username.trim();
    const emailValue = email.toLowerCase().trim();

    if (fullNameValue.length < 2 || fullNameValue.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Full name must be between 2 and 100 characters',
      });
      return;
    }

    if (usernameValue.length < 3 || usernameValue.length > 30) {
      res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters',
      });
      return;
    }

    const { data: existingEmail, error: emailError } = await supabase
      .from('users')
      .select('id')
      .eq('email', emailValue)
      .maybeSingle();
    if (emailError) throw emailError;
    if (existingEmail) {
      res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
      return;
    }

    const { data: existingUsername, error: usernameError } = await supabase
      .from('users')
      .select('id')
      .ilike('username', likeLiteral(usernameValue))
      .maybeSingle();
    if (usernameError) throw usernameError;
    if (existingUsername) {
      res.status(409).json({
        success: false,
        message: 'Username is already taken',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: fullNameValue,
        username: usernameValue,
        email: emailValue,
        password_hash: passwordHash,
        role: 'user',
      })
      .select(USER_COLUMNS)
      .single();

    // Lost a race with a concurrent registration: the unique constraints caught it.
    if (isUniqueViolation(error)) {
      res.status(409).json({
        success: false,
        message: error?.message.includes('username')
          ? 'Username is already taken'
          : 'Email is already registered',
      });
      return;
    }
    if (error) throw error;

    const user = toUser(data as unknown as UserRow);
    const token = signToken(user._id);

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

async function findUserForLogin(value: string): Promise<UserWithHash | null> {
  const columns = `${USER_COLUMNS}, password_hash`;

  const byEmail = await supabase
    .from('users')
    .select(columns)
    .eq('email', value.toLowerCase())
    .maybeSingle();
  if (byEmail.error) throw byEmail.error;
  if (byEmail.data) return byEmail.data as unknown as UserWithHash;

  const byUsername = await supabase
    .from('users')
    .select(columns)
    .ilike('username', likeLiteral(value))
    .maybeSingle();
  if (byUsername.error) throw byUsername.error;

  return (byUsername.data as unknown as UserWithHash | null) ?? null;
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

    const user = await findUserForLogin(emailOrUsername.trim());

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const token = signToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(toUser(user)),
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
