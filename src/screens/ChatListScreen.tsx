import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RealtimeChannel } from '@supabase/supabase-js';
import { format, isToday, isYesterday } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Reanimated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MessagesStackParamList, TabParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  type: string;
};

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen?: string;
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
    is_online?: boolean;
    last_seen?: string;
  };
};

type SearchUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_online?: boolean;
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

const truncateMessage = (message: string, type: string = 'text') => {
  if (type === 'image') return '📷 Photo';
  if (type === 'audio') return '🎵 Voice message';
  if (type === 'video') return '🎥 Video';
  if (message.length <= MAX_MESSAGE_PREVIEW_LENGTH) return message;
  return `${message.substring(0, MAX_MESSAGE_PREVIEW_LENGTH)}...`;
};

const getMessageTypeIcon = (type: string) => {
  switch (type) {
    case 'image': return 'camera';
    case 'audio': return 'mic';
    case 'video': return 'videocam';
    default: return null;
  }
};

// Enhanced Avatar Component with online status
const Avatar: React.FC<{
  uri?: string | null;
  name: string;
  size?: number;
  isOnline?: boolean;
  showOnlineStatus?: boolean;
}> = ({ uri, name, size = 56, isOnline = false, showOnlineStatus = true }) => {
  const [imageError, setImageError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      <Animated.View style={[{ opacity: fadeAnim }, styles.avatarWrapper]}>
        {uri && !imageError ? (
          <Image
            source={{ uri }}
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[
            styles.avatarPlaceholder, 
            { 
              width: size, 
              height: size, 
              borderRadius: size / 2,
              backgroundColor: colors.primary + '20'
            }
          ]}>
            <Text style={[
              styles.avatarInitial, 
              { 
                fontSize: size * 0.4,
                color: colors.primary
              }
            ]}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </Animated.View>
      
      {showOnlineStatus && isOnline && (
        <View style={[
          styles.onlineIndicator,
          {
            width: size * 0.25,
            height: size * 0.25,
            borderRadius: size * 0.125,
            backgroundColor: colors.success,
            right: size * 0.05,
            bottom: size * 0.05,
          }
        ]} />
      )}
    </View>
  );
};

// Enhanced Conversation Item Component
const ConversationItem: React.FC<{
  item: Conversation;
  isEditMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  onMarkAsRead: () => void;
}> = ({ item, isEditMode, isSelected, onPress, onLongPress, onDelete, onMarkAsRead }) => {
  const latestMessage = item.last_message;
  const unreadCount = item.unread_count || 0;
  const messageDate = latestMessage?.created_at ? new Date(latestMessage.created_at) : null;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      {unreadCount > 0 && (
        <TouchableOpacity
          style={[styles.swipeAction, styles.markReadAction]}
          onPress={onMarkAsRead}
        >
          <Ionicons name="checkmark-done" size={20} color={colors.white} />
          <Text style={styles.swipeActionText}>Read</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={20} color={colors.white} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Reanimated.View
        entering={FadeInDown.delay(100).springify()}
        layout={Layout.springify()}
      >
        <Reanimated.View style={animatedStyle}>
          <TouchableOpacity
            style={[
              styles.conversationItem,
              isEditMode && styles.conversationItemEditMode,
              isSelected && styles.selectedConversation,
              unreadCount > 0 && styles.unreadConversation,
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.7}
          >
          <View style={styles.conversationContainer}>
            {isEditMode && (
              <View style={styles.checkboxContainer}>
                <View style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected
                ]}>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color={colors.white} />
                  )}
                </View>
              </View>
            )}
            
            <Avatar
              uri={item.other_user?.avatar_url}
              name={item.other_user?.name || 'Anonymous'}
              isOnline={item.other_user?.is_online}
            />

            <View style={styles.messageContent}>
              <View style={styles.messageHeader}>
                <Text style={[
                  styles.userName,
                  unreadCount > 0 && styles.unreadUserName
                ]} numberOfLines={1}>
                  {item.other_user?.name || 'Anonymous User'}
                </Text>
                <View style={styles.timeContainer}>
                  <Text style={[
                    styles.messageTime,
                    unreadCount > 0 && styles.unreadTime
                  ]}>
                    {messageDate ? formatMessageTime(messageDate) : ''}
                  </Text>
                  {latestMessage?.sender_id !== item.other_user?.id && (
                    <Ionicons 
                      name="checkmark-done" 
                      size={14} 
                      color={latestMessage?.status === 'read' ? colors.primary : colors.text.light}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
              </View>

              <View style={styles.messagePreview}>
                <View style={styles.lastMessageContainer}>
                  {getMessageTypeIcon(latestMessage?.type) && (
                    <Ionicons 
                      name={getMessageTypeIcon(latestMessage?.type) as any}
                      size={16}
                      color={unreadCount > 0 ? colors.text.primary : colors.text.secondary}
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text 
                    style={[
                      styles.lastMessage,
                      unreadCount > 0 && styles.unreadMessage
                    ]}
                    numberOfLines={1}
                  >
                    {latestMessage?.content 
                      ? truncateMessage(latestMessage.content, latestMessage.type)
                      : 'No messages yet'}
                  </Text>
                </View>
                
                {unreadCount > 0 && !isEditMode && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
        </Reanimated.View>
      </Reanimated.View>
    </Swipeable>
  );
};

// Enhanced Search Bar Component
const SearchBar: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  isFocused: boolean;
}> = ({ value, onChangeText, onFocus, onBlur, isFocused }) => {
  const searchWidth = useSharedValue(SCREEN_WIDTH - 32);
  const cancelOpacity = useSharedValue(0);

  const searchAnimatedStyle = useAnimatedStyle(() => ({
    width: searchWidth.value,
  }));

  const cancelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cancelOpacity.value,
  }));

  useEffect(() => {
    if (isFocused) {
      searchWidth.value = withTiming(SCREEN_WIDTH - 100);
      cancelOpacity.value = withTiming(1);
    } else {
      searchWidth.value = withTiming(SCREEN_WIDTH - 32);
      cancelOpacity.value = withTiming(0);
    }
  }, [isFocused]);

  return (
    <View style={styles.searchContainer}>
      <Reanimated.View style={[styles.searchInputContainer, searchAnimatedStyle]}>
        <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages or users"
          placeholderTextColor={colors.text.secondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </Reanimated.View>
      
      {isFocused && (
        <Reanimated.View style={cancelAnimatedStyle}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onBlur}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Reanimated.View>
      )}
    </View>
  );
};

const ChatListScreen = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const navigation = useNavigation<ChatListScreenNavigationProp>();
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(conv => 
      conv.other_user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.last_message?.content?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Enhanced header configuration
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Messages</Text>
          {conversations.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {(() => {
                const unreadConversations = conversations.filter(c => c.unread_count > 0);
                const totalUnreadMessages = conversations.reduce((sum, c) => sum + c.unread_count, 0);
                
                if (totalUnreadMessages === 0) {
                  return 'All caught up';
                } else if (unreadConversations.length === 1) {
                  return `${totalUnreadMessages} unread message${totalUnreadMessages > 1 ? 's' : ''}`;
                } else {
                  return `${unreadConversations.length} conversations, ${totalUnreadMessages} unread`;
                }
              })()}
            </Text>
          )}
        </View>
      ),
      headerStyle: {
        backgroundColor: colors.white,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
          onPress={() => navigation.navigate('Messages', { screen: 'NewChat' })}
          style={styles.headerButton}
        >
          <Ionicons name="create-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            setIsEditMode(!isEditMode);
            if (!isEditMode) {
              setSelectedConversations(new Set());
            }
          }}
          style={styles.headerButton}
        >
          <Text style={styles.editButton}>{isEditMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditMode, conversations]);

  // Debug logging
  useEffect(() => {
    console.log('[ChatListScreen] Component mounted');
    console.log('[ChatListScreen] Profile:', profile);
  }, [profile]);

  // Focus effect for refreshing data
  useFocusEffect(
    useCallback(() => {
      console.log('[ChatListScreen] Screen focused, fetching conversations');
      fetchConversations();
      setupRealtimeSubscription();
      
      return () => {
        if (messageSubscription) {
          messageSubscription.unsubscribe();
        }
      };
    }, [profile?.id])
  );

  const setupRealtimeSubscription = useCallback(async () => {
      if (!profile?.id) return;

    try {
      // Unsubscribe from existing channel if any
      if (messageSubscription) {
        await messageSubscription.unsubscribe();
      }

      console.log('[ChatListScreen] Setting up realtime subscription');
      
      const subscription = supabase
        .channel('chat_list_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            console.log('[ChatListScreen] Realtime update received:', payload);
            // Refresh conversations when messages are updated
            fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          (payload) => {
            console.log('[ChatListScreen] Conversation update received:', payload);
            fetchConversations();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Chat list subscription connected successfully');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('⚠️ Chat list subscription error - continuing with polling fallback');
          } else {
            console.log('[ChatListScreen] Subscription status:', status);
          }
        });

      setMessageSubscription(subscription);
    } catch (error) {
      console.error('[ChatListScreen] Error setting up subscription:', error);
      }
  }, [profile?.id, messageSubscription]);

  const fetchConversations = async () => {
    if (!profile?.id) {
      console.log('[ChatListScreen] No profile found, skipping fetch');
      setLoading(false);
      return;
    }

    try {
      console.log('[ChatListScreen] fetchConversations called');
      console.log('[ChatListScreen] Fetching conversations for user:', profile.id);
      
      setError(null);
      
      // Fetch all messages involving the current user
      console.log('[ChatListScreen] Querying messages table...');
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          receiver_id,
          type,
          status,
          read_at,
          sender:profiles!messages_sender_id_fkey(
            id,
            name,
            avatar_url
          ),
          receiver:profiles!messages_receiver_id_fkey(
            id,
            name,
            avatar_url
          )
        `)
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('[ChatListScreen] Error fetching messages:', messagesError);
        throw messagesError;
      }

      console.log('[ChatListScreen] Messages fetched:', messages?.length || 0);

      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Group messages into conversations
      console.log('[ChatListScreen] Grouping messages into conversations...');
      const conversationMap = new Map<string, Conversation>();
      
      messages.forEach((message: any) => {
        // Determine the other user
        const isCurrentUserSender = message.sender_id === profile.id;
        const otherUserId = isCurrentUserSender ? message.receiver_id : message.sender_id;
        const otherUser = isCurrentUserSender ? message.receiver : message.sender;

          if (!otherUser) {
          console.warn(`[ChatListScreen] Skipping message ${message.id} - missing user data (sender: ${message.sender_id}, receiver: ${message.receiver_id})`);
            return;
          }

        // Skip self-conversations (messages to/from the same user)
        if (otherUserId === profile.id) {
          console.warn(`[ChatListScreen] Skipping self-conversation for message ${message.id}`);
          return;
        }

        // Create conversation key (always use smaller ID first for consistency)
        const conversationKey = [profile.id, otherUserId].sort().join('-');

        if (!conversationMap.has(conversationKey)) {
          // Create new conversation
          conversationMap.set(conversationKey, {
            id: conversationKey,
              user1_id: profile.id,
              user2_id: otherUserId,
              updated_at: message.created_at,
            unread_count: 0,
              last_message: {
                id: message.id,
                content: message.content,
                created_at: message.created_at,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
              type: message.type || 'text',
              sender: message.sender,
              status: message.status || 'sent',
              },
              other_user: {
              id: otherUser.id,
              name: otherUser.name || 'Unknown User',
              avatar_url: otherUser.avatar_url,
              is_online: false, // Default to offline since column doesn't exist
              last_seen: undefined,
            },
          });
        }

        // Update unread count for messages received by current user
        if (message.receiver_id === profile.id && !message.read_at) {
          const conversation = conversationMap.get(conversationKey);
          if (conversation) {
              conversation.unread_count += 1;
            }
        }
      });

      const conversationsArray = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime());

      console.log('[ChatListScreen] Conversations created:', conversationsArray.length);
      setConversations(conversationsArray);
    } catch (error) {
      console.error('[ChatListScreen] Error fetching conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    if (selectedConversations.size === 0) return;

    Alert.alert(
      'Delete Conversations',
      `Are you sure you want to delete ${selectedConversations.size} conversation(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete messages for selected conversations
              for (const conversationId of selectedConversations) {
                const conversation = conversations.find(c => c.id === conversationId);
                if (conversation) {
                  await supabase
                    .from('messages')
        .delete()
                    .or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${conversation.other_user.id}),and(sender_id.eq.${conversation.other_user.id},receiver_id.eq.${profile?.id})`);
                }
              }

      setSelectedConversations(new Set());
      setIsEditMode(false);
              fetchConversations();
    } catch (error) {
      console.error('Error deleting conversations:', error);
              Alert.alert('Error', 'Failed to delete conversations');
    }
          }
        }
      ]
    );
  };

  const handleMarkAsRead = async () => {
    if (selectedConversations.size === 0) return;

    try {
      for (const conversationId of selectedConversations) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (conversation) {
          await supabase
            .from('messages')
            .update({ 
              read_at: new Date().toISOString(),
              status: 'read'
            })
            .match({ 
              receiver_id: profile?.id,
              sender_id: conversation.other_user.id
            })
            .is('read_at', null);
        }
      }
      
      setSelectedConversations(new Set());
      setIsEditMode(false);
      fetchConversations();
    } catch (error) {
      console.error('Error marking as read:', error);
      Alert.alert('Error', 'Failed to mark conversations as read');
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
        .ilike('name', `%${query}%`)
        .neq('id', profile?.id)
        .limit(10);

      if (error) throw error;
      // Add default is_online property since it doesn't exist in the database
      const resultsWithOnlineStatus = (data || []).map(user => ({
        ...user,
        is_online: false // Default to offline since column doesn't exist
      }));
      setSearchResults(resultsWithOnlineStatus);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUserSelect = async (user: SearchUser) => {
    try {
      // Check if conversation already exists
      const existingConversation = conversations.find(conv => 
        conv.other_user.id === user.id
      );

      if (existingConversation) {
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            otherUserId: user.id,
            otherUserName: user.name,
            otherUserAvatar: user.avatar_url
          }
        });
      } else {
        // Navigate to new conversation
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            otherUserId: user.id,
            otherUserName: user.name,
            otherUserAvatar: user.avatar_url
          }
        });
      }
      
      setSearchQuery('');
      setIsSearching(false);
      setSearchFocused(false);
    } catch (error) {
      console.error('Error selecting user:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleConversationPress = async (conversation: Conversation) => {
          if (isEditMode) {
      handleConversationSelect(conversation.id);
          } else {
      // Auto-mark conversation as read when opening
      if (conversation.unread_count > 0) {
        try {
          await handleMarkSingleAsRead(conversation);
        } catch (error) {
          console.warn('Failed to auto-mark conversation as read:', error);
          // Continue navigation even if mark-as-read fails
        }
      }
      
            navigation.navigate('Messages', {
              screen: 'Chat',
              params: {
          otherUserId: conversation.other_user.id,
          otherUserName: conversation.other_user.name || 'Anonymous User',
          otherUserAvatar: conversation.other_user.avatar_url
              }
            });
          }
  };

  const handleConversationLongPress = (conversation: Conversation) => {
    if (!isEditMode) {
      setIsEditMode(true);
      setSelectedConversations(new Set([conversation.id]));
    }
  };

  const handleDeleteSingleConversation = async (conversation: Conversation) => {
    Alert.alert(
      'Delete Conversation',
      `Delete conversation with ${conversation.other_user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('messages')
                .delete()
                .or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${conversation.other_user.id}),and(sender_id.eq.${conversation.other_user.id},receiver_id.eq.${profile?.id})`);
              
              fetchConversations();
            } catch (error) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation');
            }
          }
        }
      ]
    );
  };

  const handleMarkSingleAsRead = async (conversation: Conversation) => {
    try {
      await supabase
        .from('messages')
        .update({ 
          read_at: new Date().toISOString(),
          status: 'read'
        })
        .match({ 
          receiver_id: profile?.id,
          sender_id: conversation.other_user.id
        })
        .is('read_at', null);
      
      fetchConversations();
    } catch (error) {
      console.error('Error marking as read:', error);
      Alert.alert('Error', 'Failed to mark as read');
    }
  };

  const renderConversationItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      item={item}
      isEditMode={isEditMode}
      isSelected={selectedConversations.has(item.id)}
      onPress={() => handleConversationPress(item)}
      onLongPress={() => handleConversationLongPress(item)}
      onDelete={() => handleDeleteSingleConversation(item)}
      onMarkAsRead={() => handleMarkSingleAsRead(item)}
    />
  ), [isEditMode, selectedConversations]);

  const renderSearchResult = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleUserSelect(item)}
    >
      <Avatar
        uri={item.avatar_url}
        name={item.name}
        size={48}
        isOnline={item.is_online}
          />
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultStatus}>
          Tap to start conversation
            </Text>
          </View>
    </TouchableOpacity>
  );

  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.text.light} />
      <Text style={styles.emptyText}>
        {error || (searchQuery ? 'No matches found' : 'No conversations yet')}
      </Text>
      <Text style={styles.emptySubtext}>
        {!error && !searchQuery && 'Start a conversation by tapping the compose button'}
      </Text>
    </View>
  ), [error, searchQuery]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        
        <SearchBar
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
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          isFocused={searchFocused}
        />

      {isEditMode && selectedConversations.size > 0 && (
          <Reanimated.View 
            style={styles.editActions}
            entering={FadeInDown.springify()}
            exiting={FadeOutUp.springify()}
          >
            <TouchableOpacity
            onPress={handleMarkAsRead}
            style={styles.editActionButton}
          >
              <Ionicons name="checkmark-done" size={20} color={colors.primary} />
            <Text style={styles.editActionText}>Mark as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity
            onPress={handleDeleteConversations}
            style={[styles.editActionButton, styles.deleteButton]}
          >
              <Ionicons name="trash" size={20} color={colors.white} />
            <Text style={[styles.editActionText, styles.deleteButtonText]}>Delete</Text>
            </TouchableOpacity>
          </Reanimated.View>
      )}

        {isSearching ? (
          <FlatList<SearchUser>
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContainer,
              searchResults.length === 0 && styles.emptyList
            ]}
          ListEmptyComponent={
            searchLoading ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.searchLoadingText}>Searching...</Text>
                </View>
            ) : (
              <ListEmptyComponent />
            )
          }
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === 'android'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        />
      ) : (
          <FlatList<Conversation>
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            filteredConversations.length === 0 && styles.emptyList
          ]}
            refreshControl={
              <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchConversations();
          }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={<ListEmptyComponent />}
            initialNumToRender={15}
          maxToRenderPerBatch={10}
            windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        />
      )}
    </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  editButton: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 40,
    flex: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    height: '100%',
    ...Platform.select({
      ios: { padding: 0 },
    }),
  },
  cancelButton: {
    paddingLeft: spacing.md,
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
  },
  listContainer: {
    flexGrow: 1,
  },
  emptyList: {
    flex: 1,
  },
  conversationItem: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  conversationItemEditMode: {
    paddingLeft: spacing.sm,
  },
  selectedConversation: {
    backgroundColor: colors.primary + '10',
  },
  unreadConversation: {
    backgroundColor: colors.white,
  },
  conversationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: colors.background,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontWeight: typography.weights.semibold,
  },
  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadUserName: {
    fontWeight: typography.weights.bold,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  unreadTime: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMessage: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  unreadMessage: {
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadCount: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  markReadAction: {
    backgroundColor: colors.primary,
  },
  deleteAction: {
    backgroundColor: colors.error,
  },
  swipeActionText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.white,
    ...shadows.small,
  },
  editActionText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: colors.white,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  searchResultContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  searchResultName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
  },
  searchResultStatus: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  searchLoadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.sizes.md * 1.4,
  },
});

export default ChatListScreen;