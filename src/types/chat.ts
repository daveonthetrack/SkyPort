import { Database } from '../types/supabase';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
  AUDIO = 'audio'
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface Sender {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface MessageMetadata {
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
  file_size?: number;
  originalWidth?: number;
  originalHeight?: number;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  edited_at: string | null;
  type: MessageType;
  status: MessageStatus;
  read_at: string | null;
  image_url?: string;
  audio_url?: string;
  reply_to?: string;
  metadata?: MessageMetadata;
  reactions?: Record<string, number>;
  item_id?: string;
  trip_id?: string;
  sender: Sender;
  receiver: Sender;
}

export interface Conversation {
  id: string;
  last_message: Message | null;
  other_user: Sender;
  unread_count: number;
  updated_at: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

// Type-safe database types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbProfile = Database['public']['Tables']['profiles']['Row'];

// Chat service types
export interface SendMessageParams {
  content: string;
  sender_id: string;
  receiver_id: string;
  item_id?: string;
  trip_id?: string;
  type: MessageType;
  image_url?: string;
  reply_to?: string;
}

export interface FetchMessagesParams {
  userId: string;
  otherUserId: string;
  itemId?: string;
  tripId?: string;
}

export interface FetchConversationsParams {
  userId: string;
}

// Chat context types
export interface ChatContextType {
  conversations: Conversation[];
  loadingConversations: boolean;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (otherUserId: string) => Promise<void>;
  deleteConversation: (otherUserId: string) => Promise<void>;
}

// Navigation params
export interface ChatScreenParams {
  otherUserId: string;
  otherUserName: string;
  itemId?: string;
  tripId?: string;
} 