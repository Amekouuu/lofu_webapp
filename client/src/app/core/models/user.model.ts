export interface User {
  _id: string;
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}