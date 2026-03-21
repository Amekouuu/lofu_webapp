export type PostType = 'Lost' | 'Found';
export type PostStatus = 'Active' | 'Claim Pending' | 'Resolved';

export interface PostAuthor {
  _id: string;
  fullName: string;
  username: string;
  avatar: string;
}

export interface Post {
  _id: string;
  author: PostAuthor;
  type: PostType;
  itemName: string;
  category: string;
  description: string;
  color?: string;
  brand?: string;
  landmark: string;
  locationDetails?: string;
  dateLostOrFound: string;
  incidentTimeApprox?: string;
  rewardOffered?: string;
  images: string[];
  status: PostStatus;
  approvedClaimId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostsResponse {
  success: boolean;
  posts: Post[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  counts: {
    lost: number;
    found: number;
  };
}