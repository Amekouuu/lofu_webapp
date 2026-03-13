import { Schema, model, Document, Types } from 'mongoose';

export type ClaimStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ClaimDocument extends Document {
  post: Types.ObjectId;
  claimant: Types.ObjectId;
  message: string;
  proofDetails: string;
  contactInfo?: string;
  status: ClaimStatus;
  createdAt: Date;
  updatedAt: Date;
}

const claimSchema = new Schema<ClaimDocument>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    claimant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    proofDetails: {
      type: String,
      required: true,
      trim: true,
    },
    contactInfo: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

export const Claim = model<ClaimDocument>('Claim', claimSchema);