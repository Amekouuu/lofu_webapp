import { Schema, model, Document, Types } from 'mongoose';

export interface ConversationDocument extends Document {
  participants: Types.ObjectId[];
  post: Types.ObjectId;
  claim: Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    claim: {
      type: Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const Conversation = model<ConversationDocument>('Conversation', conversationSchema);