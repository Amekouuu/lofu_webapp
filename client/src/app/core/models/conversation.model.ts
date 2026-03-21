export interface ConversationParticipant {
  _id: string;
  fullName: string;
  username: string;
  avatar?: string;
}

export interface ConversationPost {
  _id: string;
  itemName: string;
  type: 'Lost' | 'Found';
  images: string[];
}

export interface Conversation {
  _id: string;
  participants: ConversationParticipant[];
  post: ConversationPost;
  claim: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ConversationParticipant;
  content: string;
  createdAt: string;
}