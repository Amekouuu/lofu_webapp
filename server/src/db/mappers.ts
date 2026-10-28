// Converts Postgres rows (snake_case, `id`) into the JSON shape the Mongoose
// version returned (camelCase, `_id`, populated sub-objects), so the Angular
// client keeps working unchanged.

export type Role = 'user' | 'admin';
export type PostType = 'Lost' | 'Found';
export type PostStatus = 'Active' | 'Claim Pending' | 'Resolved';
export type ClaimStatus = 'Pending' | 'Approved' | 'Rejected';

// ── users ──────────────────────────────────────────────────────────────
// password_hash is deliberately absent: it is only selected where needed.
export const USER_COLUMNS =
  'id, full_name, username, email, avatar, role, profile_visible, show_email, created_at, updated_at';
export const USER_SUMMARY_COLUMNS = 'id, full_name, username, avatar';

export interface UserRow {
  id: string;
  full_name: string;
  username: string;
  email: string;
  avatar: string | null;
  role: Role;
  profile_visible: boolean;
  show_email: boolean;
  created_at: string;
  updated_at: string;
}

export type UserSummaryRow = Pick<UserRow, 'id' | 'full_name' | 'username' | 'avatar'>;

export interface AppUser {
  _id: string;
  id: string;
  fullName: string;
  username: string;
  email: string;
  avatar: string;
  role: Role;
  privacySettings: { profileVisible: boolean; showEmail: boolean };
  createdAt: string;
  updatedAt: string;
}

export function toUser(row: UserRow): AppUser {
  return {
    _id: row.id,
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    avatar: row.avatar || '',
    role: row.role,
    privacySettings: { profileVisible: row.profile_visible, showEmail: row.show_email },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUserSummary(row: UserSummaryRow) {
  return {
    _id: row.id,
    fullName: row.full_name,
    username: row.username,
    avatar: row.avatar || '',
  };
}

// ── posts ──────────────────────────────────────────────────────────────
export interface PostRow {
  id: string;
  author_id: string;
  type: PostType;
  item_name: string;
  category: string;
  description: string;
  color: string;
  brand: string;
  landmark: string;
  location_details: string;
  date_lost_or_found: string;
  incident_time_approx: string | null;
  reward_offered: string | null;
  images: string[];
  status: PostStatus;
  approved_claim_id: string | null;
  created_at: string;
  updated_at: string;
  author?: UserSummaryRow | null;
}

export function toPost(row: PostRow) {
  return {
    _id: row.id,
    author: row.author ? toUserSummary(row.author) : row.author_id,
    type: row.type,
    itemName: row.item_name,
    category: row.category,
    description: row.description,
    color: row.color,
    brand: row.brand,
    landmark: row.landmark,
    locationDetails: row.location_details,
    dateLostOrFound: row.date_lost_or_found,
    incidentTimeApprox: row.incident_time_approx ?? undefined,
    rewardOffered: row.reward_offered ?? undefined,
    images: row.images ?? [],
    status: row.status,
    approvedClaimId: row.approved_claim_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Partial post, as embedded inside claims and conversations.
export type PostSummaryRow = Partial<PostRow> & { id: string };

export function toPostSummary(row: PostSummaryRow) {
  return {
    _id: row.id,
    itemName: row.item_name,
    type: row.type,
    status: row.status,
    images: row.images ?? [],
    ...(row.landmark !== undefined && { landmark: row.landmark }),
  };
}

// ── claims ─────────────────────────────────────────────────────────────
export interface ClaimRow {
  id: string;
  post_id: string;
  claimant_id: string;
  message: string;
  proof_details: string;
  contact_info: string;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
  post?: PostSummaryRow | null;
  claimant?: UserSummaryRow | null;
}

export function toClaim(row: ClaimRow) {
  return {
    _id: row.id,
    post: row.post ? toPostSummary(row.post) : row.post_id,
    claimant: row.claimant ? toUserSummary(row.claimant) : row.claimant_id,
    message: row.message,
    proofDetails: row.proof_details,
    contactInfo: row.contact_info,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── conversations & messages ───────────────────────────────────────────
export interface ConversationRow {
  id: string;
  post_id: string | null;
  claim_id: string | null;
  last_message: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  post?: PostSummaryRow | null;
  participants?: { user: UserSummaryRow | null }[];
}

export function toConversation(row: ConversationRow) {
  return {
    _id: row.id,
    participants: (row.participants ?? [])
      .map((p) => p.user)
      .filter((u): u is UserSummaryRow => u !== null)
      .map(toUserSummary),
    post: row.post ? toPostSummary(row.post) : null,
    claim: row.claim_id,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const MESSAGE_SELECT =
  `id, conversation_id, sender_id, content, created_at, updated_at, sender:users!sender_id(${USER_SUMMARY_COLUMNS})`;

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  sender?: UserSummaryRow | null;
}

export function toMessage(row: MessageRow) {
  return {
    _id: row.id,
    conversation: row.conversation_id,
    sender: row.sender ? toUserSummary(row.sender) : null,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
