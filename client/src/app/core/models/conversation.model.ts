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
  post: ConversationPost | null; // null once the post has been deleted
  claim: string;
  lastMessage?: string;
  lastMessageAt?: string;
  // Who wrote the newest message (null when unknown)
  lastMessageSenderId?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: ConversationParticipant;
  content: string;
  createdAt: string;
}