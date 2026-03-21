import { Schema, model, Document } from 'mongoose';

export interface UserDocument extends Document {
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  role: 'user' | 'admin';
  privacySettings: {
    profileVisible: boolean;
    showEmail: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    privacySettings: {
      profileVisible: { type: Boolean, default: true },
      showEmail:      { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<UserDocument>('User', userSchema);