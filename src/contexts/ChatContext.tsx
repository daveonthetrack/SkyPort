import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/chatService';
import { Conversation, ChatContextType } from '../types/chat';
import { useAuth } from './AuthContext';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const { session } = useAuth();

  const refreshConversations = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoadingConversations(true);
      const conversations = await chatService.fetchConversations({ 
        userId: session.user.id 
      });
      setConversations(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const markConversationAsRead = async (otherUserId: string) => {
    if (!session?.user?.id) return;
    
    try {
      await chatService.markConversationAsRead(session.user.id, otherUserId);
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.other_user.id === otherUserId 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  const deleteConversation = async (otherUserId: string) => {
    if (!session?.user?.id) return;
    
    try {
      // Remove from local state first for optimistic update
      setConversations(prev => 
        prev.filter(conv => conv.other_user.id !== otherUserId)
      );
      
      // TODO: Implement conversation deletion in the backend
      // await chatService.deleteConversation(session.user.id, otherUserId);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Revert on error
      refreshConversations();
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      refreshConversations();

      // Subscribe to new messages
      const subscription = supabase
        .channel('chat-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${session.user.id}`,
          },
          async () => {
            // Refresh conversations when a new message is received
            await refreshConversations();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [session?.user?.id]);

  const value: ChatContextType = {
    conversations,
    loadingConversations,
    refreshConversations,
    markConversationAsRead,
    deleteConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 