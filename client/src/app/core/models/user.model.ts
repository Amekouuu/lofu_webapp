export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}