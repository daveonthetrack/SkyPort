import { supabase } from '../lib/supabase';
import {
    Conversation,
    FetchMessagesParams,
    Message,
    MessageStatus,
    MessageType,
    SendMessageParams
} from '../types/chat';

class ChatService {
  private static instance: ChatService;

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Fetch messages between two users
   */
  async fetchMessages({ userId, otherUserId, itemId, tripId }: FetchMessagesParams): Promise<Message[]> {
    try {
      console.log('Fetching messages with params:', { userId, otherUserId, itemId, tripId });

      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
        `)
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }
      if (tripId) {
        query = query.eq('trip_id', tripId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        throw new Error(error.message);
      }

      console.log('Fetched messages:', data);

      if (!data) return [];

      // Mark messages as read if the current user is the receiver
      const unreadMessages = data.filter(
        message => message.receiver_id === userId && !message.read_at
      );

      if (unreadMessages.length > 0) {
        await Promise.all(
          unreadMessages.map(message =>
            supabase.rpc('mark_message_as_read', {
              message_id: message.id
            })
          )
        );
      }

      // Reverse the array to show messages in chronological order
      const messages = data.reverse().map(message => ({
        id: message.id,
        content: message.content,
        created_at: message.created_at,
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        item_id: message.item_id,
        trip_id: message.trip_id,
        image_url: message.image_url,
        type: message.type as MessageType,
        read_at: message.read_at,
        updated_at: message.updated_at || message.created_at,
        deleted_at: null,
        edited_at: null,
        status: message.status || MessageStatus.SENT,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatar_url: message.sender.avatar_url
        },
        receiver: {
          id: message.receiver.id,
          name: message.receiver.name,
          avatar_url: message.receiver.avatar_url
        }
      }));

      return messages;
    } catch (error) {
      console.error('Error in fetchMessages:', error);
      throw error;
    }
  }

  /**
   * Send a new message
   */
  async sendMessage({
    content,
    sender_id,
    receiver_id,
    item_id,
    trip_id,
    image_url,
    type = MessageType.TEXT
  }: SendMessageParams): Promise<Message> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          sender_id,
          receiver_id,
          item_id,
          trip_id,
          image_url,
          type,
          read_at: null
        })
        .select('*, sender:profiles!messages_sender_id_fkey(id, name, avatar_url)')
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to send message');

      // Update or create conversation
      await this.updateConversation({
        user1_id: sender_id,
        user2_id: receiver_id,
        last_message: content,
        item_id,
        trip_id
      });

      return {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        sender_id: data.sender_id,
        receiver_id: data.receiver_id,
        item_id: data.item_id,
        trip_id: data.trip_id,
        image_url: data.image_url,
        type: data.type as MessageType,
        read_at: data.read_at,
        updated_at: data.updated_at || data.created_at,
        deleted_at: null,
        edited_at: null,
        status: data.status || MessageStatus.SENT,
        sender: {
          id: data.sender.id,
          name: data.sender.name,
          avatar_url: data.sender.avatar_url
        },
        receiver: {
          id: data.receiver.id,
          name: data.receiver.name,
          avatar_url: data.receiver.avatar_url
        }
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Fetch conversations for a user
   */
  async fetchConversations(userId: string): Promise<Conversation[]> {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          updated_at,
          unread_count,
          last_message,
          last_message_at,
          other_user:profiles!conversations_user1_id_fkey(id, name, avatar_url),
          other_user2:profiles!conversations_user2_id_fkey(id, name, avatar_url)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(error.message);

      return conversations.map((conv: any) => {
        const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
        const otherUser = conv.user1_id === userId ? conv.other_user2 : conv.other_user;
        return {
          id: conv.id,
          last_message: conv.last_message ? {
            id: conv.last_message.id,
            content: conv.last_message.content,
            created_at: conv.last_message.created_at,
            sender_id: conv.last_message.sender_id,
            receiver_id: conv.last_message.receiver_id,
            type: conv.last_message.type,
            status: conv.last_message.status || MessageStatus.SENT,
            read_at: conv.last_message.read_at,
            updated_at: conv.last_message.updated_at || conv.last_message.created_at,
            deleted_at: null,
            edited_at: null,
            sender: conv.last_message.sender,
            receiver: {
              id: otherUser.id,
              name: otherUser.name,
              avatar_url: otherUser.avatar_url
            }
          } : null,
          other_user: {
            id: otherUser.id,
            name: otherUser.name,
            avatar_url: otherUser.avatar_url
          },
          unread_count: conv.unread_count,
          updated_at: conv.updated_at
        };
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Update or create a conversation
   */
  private async updateConversation({
    user1_id,
    user2_id,
    last_message,
    item_id,
    trip_id
  }: {
    user1_id: string;
    user2_id: string;
    last_message: string;
    item_id?: string;
    trip_id?: string;
  }) {
    try {
      // First check if a conversation already exists between these users
      const { data: existing } = await supabase
        .from('conversations')
        .select('id, unread_count, user1_id')
        .or(`and(user1_id.eq.${user1_id},user2_id.eq.${user2_id}),and(user1_id.eq.${user2_id},user2_id.eq.${user1_id})`)
        .single();

      if (existing) {
        // Only increment unread_count if the message is from the other user
        const isFromUser1 = user1_id === existing.user1_id;
        const unreadCount = isFromUser1 ? existing.unread_count : existing.unread_count + 1;

        await supabase
          .from('conversations')
          .update({
            last_message,
            last_message_at: new Date().toISOString(),
            unread_count: unreadCount
          })
          .eq('id', existing.id);
      } else {
        // Create a new conversation
        await supabase
          .from('conversations')
          .insert({
            user1_id,
            user2_id,
            last_message,
            last_message_at: new Date().toISOString(),
            unread_count: 1,
            item_id,
            trip_id
          });
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
      // Don't throw here as this is a secondary operation
    }
  }

  /**
   * Mark a conversation as read
   */
  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    try {
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .or(`and(user1_id.eq.${userId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${userId})`);
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await supabase.rpc('mark_message_as_read', {
        message_id: messageId
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      // First get the conversation to determine the other user
      const { data: conversation } = await supabase
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

      // Update all unread messages between these users
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .or(`and(sender_id.eq.${otherUserId},receiver_id.eq.${userId},read_at.is.null),and(sender_id.eq.${userId},receiver_id.eq.${otherUserId},read_at.is.null)`);

      if (error) throw new Error(error.message);

      // Reset unread count for this conversation
      await this.markConversationAsRead(userId, otherUserId);
    } catch (error) {
      console.error('Error marking conversation messages as read:', error);
      throw error;
    }
  }
}

export const chatService = ChatService.getInstance(); 