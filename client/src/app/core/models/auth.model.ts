import { User } from './user.model';

export interface AuthResponse {
  success: boolean;
  message?: string;
  token: string;
  user: User;
}

export interface CurrentUserResponse {
  success: boolean;
  user: User;
}

export interface ApiErrorResponse {
  success: boolean;
  message: string;
}