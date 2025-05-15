export interface Item {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Trip {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  edited_at?: string;
  read_at?: string;
  sender_id: string;
  receiver_id: string;
  type: MessageType;
  status: MessageStatus;
  sender: User;
  receiver: User;
}

export interface User {
  id: string;
  name: string;
  avatar_url?: string;
}

export type MessageType = 'text' | 'image' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Conversation {
  id: string;
  last_message: Message;
  other_user: User;
  unread_count: number;
  updated_at: string;
} 