import { Post } from './post.model';

export type ClaimStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ClaimPost {
  _id: string;
  itemName: string;
  type: 'Lost' | 'Found';
  status: string;
  images: string[];
  landmark?: string;
}

export interface ClaimUser {
  _id: string;
  fullName: string;
  username: string;
  avatar: string;
}

export interface Claim {
  _id: string;
  post: ClaimPost;
  claimant: ClaimUser;
  message: string;
  proofDetails: string;
  contactInfo?: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}