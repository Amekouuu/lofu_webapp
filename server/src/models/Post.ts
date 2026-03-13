import { Schema, model, Document, Types } from 'mongoose';

export type PostType = 'Lost' | 'Found';
export type PostStatus = 'Active' | 'Claim Pending' | 'Resolved';
export type TimeApprox = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export interface PostDocument extends Document {
  author: Types.ObjectId;
  type: PostType;
  itemName: string;
  category: string;
  description: string;
  color?: string;
  brand?: string;
  landmark: string;
  locationDetails?: string;
  dateLostOrFound: Date;
  incidentTimeApprox?: TimeApprox;
  images: string[];
  status: PostStatus;
  approvedClaimId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<PostDocument>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['Lost', 'Found'],
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: '',
      trim: true,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    landmark: {
      type: String,
      required: true,
      trim: true,
    },
    locationDetails: {
      type: String,
      default: '',
      trim: true,
    },
    dateLostOrFound: {
      type: Date,
      required: true,
    },
    incidentTimeApprox: {
      type: String,
      enum: ['Morning', 'Afternoon', 'Evening', 'Night'],
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Claim Pending', 'Resolved'],
      default: 'Active',
    },
    approvedClaimId: {
      type: Schema.Types.ObjectId,
      ref: 'Claim',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Post = model<PostDocument>('Post', postSchema);