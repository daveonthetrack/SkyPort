import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableHighlight,
  StyleSheet,
  Animated,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Platform,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CompositeNavigationProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MessagesStackParamList, TabParamList } from '../navigation/types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, shadows, borderRadius } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { RealtimeChannel } from '@supabase/supabase-js';

type ChatListScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<MessagesStackParamList, 'ChatList'>,
  BottomTabNavigationProp<TabParamList>
>;

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  read_at: string;
};

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_online: boolean;
};

type Conversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  updated_at: string;
  unread_count: number;
  last_message: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    receiver_id: string;
    type: string;
    sender: {
      id: string;
      name: string;
      avatar_url: string | null;
    };
    status: string;
  };
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

type SearchUser = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type MessageResponse = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

type ConversationResponse = {
  id: string;
  user1_id: string;
  user2_id: string;
  updated_at: string;
  unread_count: number;
  other_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  other_user2: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
};

const MAX_MESSAGE_PREVIEW_LENGTH = 50;

const formatMessageTime = (date: Date) => {
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else if (date.getFullYear() === new Date().getFullYear()) {
    return format(date, 'MMM d');
  }
  return format(date, 'MM/dd/yy');
};

const truncateMessage = (message: string) => {
  if (message.length <= MAX_MESSAGE_PREVIEW_LENGTH) return message;
  return `${message.substring(0, MAX_MESSAGE_PREVIEW_LENGTH)}...`;
};

const ChatListScreen = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const navigation = useNavigation<ChatListScreenNavigationProp>();
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);

  // Add fade-in animation for images
  const imageOpacity = new Animated.Value(0);

  const onImageLoad = () => {
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Chats',
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: Platform.OS === 'ios' ? '600' : '700',
        color: colors.primary,
      },
      headerStyle: {
        backgroundColor: '#ffffff',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerRight: () => (
        <TouchableHighlight
          onPress={() => navigation.navigate('Messages', { screen: 'NewChat' })}
          style={styles.headerButton}
          underlayColor="transparent"
        >
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableHighlight>
      ),
      headerLeft: () => (
        <TouchableHighlight
          onPress={() => {
            setIsEditMode(!isEditMode);
            if (!isEditMode) {
              setSelectedConversations(new Set());
            }
          }}
          style={styles.headerButton}
          underlayColor="transparent"
        >
          <Text style={styles.editButton}>{isEditMode ? 'Done' : 'Edit'}</Text>
        </TouchableHighlight>
      ),
    });
  }, [navigation, isEditMode]);

  // Debug: Log profile on mount and when it changes
  useEffect(() => {
    console.log('[ChatListScreen] profile:', profile);
  }, [profile]);

  // Set up realtime subscription
  useEffect(() => {
    let subscription: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      if (!profile?.id) return;

      // Unsubscribe from existing channel if any
      if (messageSubscription) {
        await messageSubscription.unsubscribe();
      }

      // Create new subscription
      subscription = supabase
        .channel('conversations_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `or(user1_id.eq.${profile.id},user2_id.eq.${profile.id})`,
          },
          () => {
            console.log('[ChatListScreen] Conversation update received');
            fetchConversations();
          }
        )
        .subscribe();

      setMessageSubscription(subscription);
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [profile?.id]); // Only re-run if profile.id changes

  const fetchConversations = async () => {
    console.log('[ChatListScreen] fetchConversations called');
    if (!profile?.id) {
      console.log('[ChatListScreen] No user profile found');
      setError('No user profile found');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('[ChatListScreen] Fetching conversations for user:', profile.id);
      
      // Get all messages for the user, grouped by conversation
      console.log('[ChatListScreen] Querying messages table...');
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          receiver_id,
          read_at,
          sender:profiles!messages_sender_id_fkey(
            id,
            name,
            avatar_url,
            role
          ),
          receiver:profiles!messages_receiver_id_fkey(
            id,
            name,
            avatar_url,
            role
          )
        `)
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('[ChatListScreen] messagesError:', messagesError);
        throw messagesError;
      }

      console.log('[ChatListScreen] Messages fetched:', messages?.length || 0);

      if (!messages || messages.length === 0) {
        console.log('[ChatListScreen] No messages found');
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Group messages by conversation (between two users)
      console.log('[ChatListScreen] Grouping messages into conversations...');
      const conversationsMap = new Map();
      
      messages.forEach((message: any) => {
        try {
          const otherUserId = message.sender_id === profile.id 
            ? message.receiver_id 
            : message.sender_id;
          
          const otherUser = message.sender_id === profile.id 
            ? message.receiver 
            : message.sender;

          if (!otherUser) {
            console.warn('[ChatListScreen] Missing user data for message:', message.id);
            return;
          }

          if (!conversationsMap.has(otherUserId)) {
            conversationsMap.set(otherUserId, {
              id: otherUserId,
              user1_id: profile.id,
              user2_id: otherUserId,
              updated_at: message.created_at,
              unread_count: message.sender_id !== profile.id && !message.read_at ? 1 : 0,
              last_message: {
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                type: 'text',
                sender: {
                  id: message.sender.id,
                  name: message.sender.name,
                  avatar_url: message.sender.avatar_url
                },
                status: 'sent'
              },
              other_user: {
                id: otherUserId,
                name: otherUser.name,
                avatar_url: otherUser.avatar_url
              }
            });
          } else {
            const conversation = conversationsMap.get(otherUserId);
            // Only increment unread count for messages from other user that haven't been read
            if (message.sender_id !== profile.id && !message.read_at) {
              conversation.unread_count += 1;
            }
            if (new Date(message.created_at) > new Date(conversation.updated_at)) {
              conversation.updated_at = message.created_at;
              conversation.last_message = {
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                type: 'text',
                sender: {
                  id: message.sender.id,
                  name: message.sender.name,
                  avatar_url: message.sender.avatar_url
                },
                status: 'sent'
              };
            }
          }
        } catch (error) {
          console.error('[ChatListScreen] Error processing message:', message.id, error);
        }
      });

      const conversations = Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      console.log('[ChatListScreen] Conversations created:', conversations.length);
      setConversations(conversations);
    } catch (error) {
      console.error('[ChatListScreen] Error fetching conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase().trim();
    return conversations.filter((conversation) => {
      const name = conversation?.other_user?.name?.toLowerCase() ?? '';
      const message = conversation?.last_message?.content?.toLowerCase() ?? '';
      return name.includes(query) || message.includes(query);
    });
  }, [conversations, searchQuery]);

  const handleConversationSelect = (conversationId: string) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const handleDeleteConversations = async () => {
    try {
      const selectedIds = Array.from(selectedConversations);
      const { error } = await supabase
        .from('conversations')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      // Remove deleted conversations from state
      setConversations(prev => prev.filter(conv => !selectedIds.includes(conv.id)));
      setSelectedConversations(new Set());
      setIsEditMode(false);
    } catch (error) {
      console.error('Error deleting conversations:', error);
      setError('Failed to delete conversations');
    }
  };

  const handleMarkAsRead = async () => {
    try {
      const selectedIds = Array.from(selectedConversations);
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .in('id', selectedIds);

      if (error) throw error;

      // Update conversations in state
      setConversations(prev => 
        prev.map(conv => 
          selectedIds.includes(conv.id) 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );
      setSelectedConversations(new Set());
      setIsEditMode(false);
    } catch (error) {
      console.error('Error marking conversations as read:', error);
      setError('Failed to mark conversations as read');
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .neq('id', profile?.id) // Exclude current user
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUserSelect = async (user: SearchUser) => {
    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${profile?.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${profile?.id})`)
        .single();

      if (existingConversation) {
        // Navigate to existing conversation using nested navigation
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            otherUserId: user.id,
            otherUserName: user.name,
            otherUserAvatar: user.avatar_url
          }
        });
      } else {
        // Create new conversation
        const { data: newConversation, error } = await supabase
          .from('conversations')
          .insert({
            user1_id: profile?.id,
            user2_id: user.id,
            last_message: null,
            last_message_at: null,
            unread_count: 0
          })
          .select()
          .single();

        if (error) throw error;

        // Navigate to new conversation using nested navigation
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            otherUserId: user.id,
            otherUserName: user.name,
            otherUserAvatar: user.avatar_url
          }
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to create conversation');
    }
  };

  const renderConversationItem = useCallback(({ item }: { item: Conversation }) => {
    const latestMessage = item.last_message;
    const unreadCount = item.unread_count || 0;
    const messageDate = latestMessage?.created_at ? new Date(latestMessage.created_at) : null;
    const isSelected = selectedConversations.has(item.id);

    return (
      <TouchableHighlight
        underlayColor="#f0f0f0"
        onPress={() => {
          if (isEditMode) {
            handleConversationSelect(item.id);
          } else {
            // Navigate to chat using nested navigation
            navigation.navigate('Messages', {
              screen: 'Chat',
              params: {
                otherUserId: item.other_user.id,
                otherUserName: item.other_user.name || 'Anonymous User',
                otherUserAvatar: item.other_user.avatar_url
              }
            });
          }
        }}
        style={[
          styles.conversationItem,
          isEditMode && styles.conversationItemEditMode,
          isSelected && styles.selectedConversation
        ]}
      >
        <View style={styles.conversationContainer}>
          {isEditMode && (
            <View style={styles.checkboxContainer}>
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected
              ]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </View>
          )}
          <View style={styles.avatarContainer}>
            {item.other_user?.avatar_url ? (
              <Animated.Image
                source={{ uri: item.other_user.avatar_url }}
                style={[styles.avatar, { opacity: imageOpacity }]}
                onLoad={onImageLoad}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {(item.other_user?.name?.[0] || 'A').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.other_user?.name || 'Anonymous User'}
              </Text>
              <Text style={styles.messageTime}>
                {messageDate ? formatMessageTime(messageDate) : ''}
              </Text>
            </View>

            <View style={styles.messagePreview}>
              <Text 
                style={[
                  styles.lastMessage,
                  unreadCount > 0 && styles.unreadMessage
                ]}
                numberOfLines={1}
              >
                {latestMessage?.content 
                  ? truncateMessage(latestMessage.content)
                  : 'No messages yet'}
              </Text>
              {unreadCount > 0 && !isEditMode && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableHighlight>
    );
  }, [isEditMode, selectedConversations]);

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.name[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.userName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const SearchBar = useCallback(() => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages or users"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (text.trim()) {
              setIsSearching(true);
              searchUsers(text);
            } else {
              setIsSearching(false);
              setSearchResults([]);
            }
          }}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  ), [searchQuery]);

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={48} color="#8E8E93" />
      <Text style={styles.emptyText}>
        {error || (searchQuery ? 'No matches found' : 'No conversations yet')}
      </Text>
    </View>
  ), [error, searchQuery]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SearchBar />
      {isEditMode && selectedConversations.size > 0 && (
        <View style={styles.editActions}>
          <TouchableHighlight
            onPress={handleMarkAsRead}
            style={styles.editActionButton}
            underlayColor="#f0f0f0"
          >
            <Text style={styles.editActionText}>Mark as Read</Text>
          </TouchableHighlight>
          <TouchableHighlight
            onPress={handleDeleteConversations}
            style={[styles.editActionButton, styles.deleteButton]}
            underlayColor="#f0f0f0"
          >
            <Text style={[styles.editActionText, styles.deleteButtonText]}>Delete</Text>
          </TouchableHighlight>
        </View>
      )}
      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : isSearching ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            searchLoading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <ListEmptyComponent />
            )
          }
        />
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            filteredConversations.length === 0 && styles.emptyList
          ]}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchConversations();
          }}
          ListEmptyComponent={ListEmptyComponent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    height: '100%',
  },
  editButton: {
    color: colors.primary,
    fontSize: 17,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomColor: '#E8E8E8',
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    height: '100%',
    ...Platform.select({
      ios: {
        padding: 0,
      },
    }),
  },
  listContainer: {
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
  },
  conversationItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  conversationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2F2F7',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    color: '#8E8E93',
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: Platform.OS === 'ios' ? '600' : '700',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  messageTime: {
    fontSize: 14,
    color: '#8E8E93',
    minWidth: 50,
    textAlign: 'right',
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    color: '#000000',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  conversationItemEditMode: {
    paddingLeft: 8,
  },
  selectedConversation: {
    backgroundColor: '#f0f0f0',
  },
  checkboxContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  editActions: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  editActionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  editActionText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
});

export default ChatListScreen;