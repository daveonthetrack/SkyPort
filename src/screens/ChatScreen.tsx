import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RealtimeChannel } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { format, isToday, isYesterday } from 'date-fns';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View
} from 'react-native';
import EmojiSelector from 'react-native-emoji-selector';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MessagesStackParamList, TabParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';
import { Message, MessageStatus, MessageType } from '../types/chat';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ChatScreenNavigationProp = CompositeNavigationProp<
  NativeStackScreenProps<MessagesStackParamList, 'Chat'>['navigation'],
  BottomTabNavigationProp<TabParamList>
>;

type ChatScreenProps = {
  route: NativeStackScreenProps<MessagesStackParamList, 'Chat'>['route'];
  navigation: ChatScreenNavigationProp;
};

interface TypingStatus {
  is_typing: boolean;
  user_id: string;
  other_user_id: string;
  updated_at: string;
}

interface MessageMetadata {
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  originalWidth?: number;
  originalHeight?: number;
  duration?: number;
}

interface MessageData {
  content: string;
  sender_id: string;
  receiver_id: string;
  type: MessageType;
  image_url?: string;
  read_at: null;
  metadata?: MessageMetadata;
}

interface MessageItemProps {
  item: Message;
  isSent: boolean;
  otherUserAvatar: string | null;
  onImagePress: (uri: string) => void;
  editingMessage: Message | null;
  onReply: (message: Message) => void;
  onLongPress: (message: Message) => void;
}

interface ImageUploadResult {
  width: number;
  height: number;
  uri: string;
  base64?: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  item, 
  isSent, 
  otherUserAvatar, 
  onImagePress, 
  editingMessage,
  onReply,
  onLongPress 
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLongPress = () => {
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    onLongPress(item);
  };

  const handlePress = () => {
    if (item.status === MessageStatus.FAILED && isSent) {
      Alert.alert(
        'Message Failed',
        'This message failed to send. Would you like to retry?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => {/* Retry logic handled in parent */} }
        ]
      );
    }
  };

  const renderMessageStatus = () => {
    if (!isSent) return null;

    const statusConfig = {
      [MessageStatus.SENDING]: { icon: 'time-outline', color: '#999' },
      [MessageStatus.SENT]: { icon: 'checkmark', color: '#999' },
      [MessageStatus.DELIVERED]: { icon: 'checkmark-done', color: '#999' },
      [MessageStatus.READ]: { icon: 'checkmark-done', color: colors.primary },
      [MessageStatus.FAILED]: { icon: 'warning', color: colors.error }
    };

    const config = statusConfig[item.status];
    if (!config) return null;

    return (
      <View style={styles.messageStatus}>
        {item.status === MessageStatus.SENDING && (
          <ActivityIndicator size="small" color="#999" style={{ marginRight: 4 }} />
        )}
        <Ionicons 
          name={config.icon as any} 
          size={12} 
          color={config.color} 
        />
      </View>
    );
  };

  const handleAudioPress = async () => {
    // Audio playback logic - can be implemented later
    console.log('Audio playback not yet implemented');
  };

  const handleImagePress = () => {
    if (item.image_url) {
      onImagePress(item.image_url);
    }
  };

  const renderImage = () => {
    if (!item.image_url) return null;
    
    const { width: imageWidth = 200, height: imageHeight = 200 } = item.metadata || {};
    const maxWidth = SCREEN_WIDTH * 0.7;
    const maxHeight = 300;
    
    let displayWidth = imageWidth;
    let displayHeight = imageHeight;
    
    if (imageWidth > maxWidth) {
      displayWidth = maxWidth;
      displayHeight = (imageHeight * maxWidth) / imageWidth;
    }
    
    if (displayHeight > maxHeight) {
      displayWidth = (displayWidth * maxHeight) / displayHeight;
      displayHeight = maxHeight;
    }

    return (
      <TouchableOpacity 
        onPress={handleImagePress}
        style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}
      >
        <Image
          source={{ uri: item.image_url }}
          style={[styles.messageImage, { width: displayWidth, height: displayHeight }]}
          resizeMode="cover"
        />
        {item.status === MessageStatus.SENDING && (
          <View style={styles.imageOverlay}>
            <ActivityIndicator color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderAudioMessage = () => {
    if (!item.audio_url) return null;
    
    return (
      <TouchableOpacity 
        style={styles.audioContainer}
        onPress={handleAudioPress}
      >
        <Ionicons name="play-circle" size={40} color={colors.primary} />
        <View style={styles.audioInfo}>
          <Text style={styles.audioText}>Voice message</Text>
          <Text style={styles.audioDuration}>
            {item.metadata?.duration ? `${Math.round(item.metadata.duration)}s` : '0:00'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageContent = () => {
    if (item.type === MessageType.IMAGE) {
      return (
        <View style={{ width: '100%' }}>
          {renderImage()}
          {item.content && (
            <Text style={[
              styles.messageText, 
              { 
                color: isSent ? colors.white : colors.text.primary,
                marginTop: 8,
                textAlign: 'left',
              }
            ]}>
              {item.content}
            </Text>
          )}
        </View>
      );
    }

    if (item.type === MessageType.AUDIO) {
      return renderAudioMessage();
    }

    return (
      <Text style={[
        enhancedStyles.modernMessageText, 
        isSent ? enhancedStyles.modernSentText : enhancedStyles.modernReceivedText,
        item.status === MessageStatus.FAILED ? { opacity: 0.6 } : {}
      ]}>
        {item.content}
      </Text>
    );
  };

  const renderReactions = () => {
    if (!item.reactions || Object.keys(item.reactions).length === 0) return null;
    
    return (
      <View style={styles.reactionsContainer}>
        {Object.entries(item.reactions).map(([emoji, count]) => (
          <View key={emoji} style={styles.reactionBadge}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={styles.reactionCount}>{count}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[
      enhancedStyles.messageWrapper, 
      isSent ? enhancedStyles.sentMessageWrapper : enhancedStyles.receivedMessageWrapper
    ]}>
      {!isSent && (
        <View style={enhancedStyles.avatarContainer}>
          {otherUserAvatar ? (
            <Image
              source={{ uri: otherUserAvatar }}
              style={enhancedStyles.modernAvatar}
            />
          ) : (
            <View style={[enhancedStyles.modernAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color={colors.text.secondary} />
            </View>
          )}
        </View>
      )}
      
      <Animated.View style={[
        animatedStyle,
        {
          alignSelf: isSent ? 'flex-end' : 'flex-start',
        }
      ]}>
        <View style={[
          enhancedStyles.messageBubbleContainer,
          isSent ? enhancedStyles.sentBubbleContainer : enhancedStyles.receivedBubbleContainer
        ]}>
          <Animated.View style={animatedStyle}>
            <TouchableOpacity
              style={[
                enhancedStyles.modernBubble,
                isSent ? enhancedStyles.modernSentBubble : enhancedStyles.modernReceivedBubble,
                item.status === MessageStatus.FAILED && styles.failedMessage,
                editingMessage?.id === item.id && styles.editingMessageBubble
              ]}
              onLongPress={handleLongPress}
              onPress={handlePress}
              delayLongPress={500}
              activeOpacity={0.8}
            >
              {/* Reply indicator */}
              {item.reply_to && (
                <View style={styles.replyIndicator}>
                  <View style={styles.replyBar} />
                  <Text style={[styles.replyText, { color: isSent ? 'rgba(255,255,255,0.8)' : colors.text.secondary }]}>
                    Replying to message
                  </Text>
                </View>
              )}

              <View style={enhancedStyles.messageContentContainer}>
                {renderMessageContent()}
              </View>
              {renderReactions()}
              
              <View style={enhancedStyles.modernMessageFooter}>
                <Text style={[enhancedStyles.modernTimestamp, isSent ? enhancedStyles.modernSentTimestamp : enhancedStyles.modernReceivedTimestamp]}>
                  {format(new Date(item.created_at), 'HH:mm')}
                  {item.edited_at && (
                    <Text style={styles.editedIndicator}> • edited</Text>
                  )}
                </Text>
                {renderMessageStatus()}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { otherUserId, otherUserName, otherUserAvatar, itemId, tripId } = route.params;
  const { session, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);
  const [typingSubscription, setTypingSubscription] = useState<RealtimeChannel | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null);
  const [messageQueue, setMessageQueue] = useState<Message[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleImagePress = useCallback((uri: string) => {
    navigation.navigate('Messages', {
      screen: 'ImageViewer',
      params: { uri }
    });
  }, [navigation]);

  // Enhanced scroll to bottom function with better performance
  const scrollToBottom = useCallback((animated: boolean = true) => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated });
    }
  }, [messages.length]);

  // Auto-scroll to bottom when messages are loaded or updated
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      // Small delay to ensure FlatList is rendered
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    }
  }, [messages.length, loading, scrollToBottom]);

  // Auto-scroll to bottom when the screen is focused (shows latest conversation)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (messages.length > 0) {
        setTimeout(() => {
          scrollToBottom(false); // No animation for initial load
        }, 200);
      }
    });

    return unsubscribe;
  }, [navigation, messages.length, scrollToBottom]);

  // Optimized message grouping with useMemo
  const groupedMessages = useMemo(() => {
    const groups = messages.reduce((acc, message) => {
      const date = new Date(message.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(message);
      return acc;
    }, {} as Record<string, Message[]>);

    // Sort messages within each group by creation time (oldest first)
    Object.keys(groups).forEach(dateKey => {
      groups[dateKey].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Sort date groups in ascending order (oldest first)
    return Object.entries(groups)
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime());
  }, [messages]);

  // Enhanced real-time subscription with optimistic updates
  const setupRealtimeSubscription = useCallback(() => {
    if (!session?.user?.id) return;

    // Clean up existing subscriptions
    if (messageSubscription) {
      messageSubscription.unsubscribe();
    }
    if (typingSubscription) {
      typingSubscription.unsubscribe();
    }

    // Messages subscription with optimistic updates
    const messagesChannel = supabase
      .channel(`chat:${session.user.id}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${session.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${session.user.id}))`,
        },
        async (payload) => {
          console.log('💬 New message received:', payload);
          const newMessage = payload.new as any;
          
          // Fetch full message data with sender/receiver info
          const { data: fullMessage, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
              receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
            `)
            .eq('id', newMessage.id)
            .single();

          if (!error && fullMessage) {
            setMessages(prev => {
              // Avoid duplicates (in case it's our own message)
              const exists = prev.find(m => m.id === fullMessage.id);
              if (exists) return prev;
              
              // Optimized: Insert at correct position instead of sorting entire array
              const messageTime = new Date(fullMessage.created_at).getTime();
              const insertIndex = prev.findIndex(m => 
                new Date(m.created_at).getTime() > messageTime
              );
              
              if (insertIndex === -1) {
                // Insert at end if it's the newest message
                return [...prev, fullMessage];
              } else {
                // Insert at the correct position
                return [
                  ...prev.slice(0, insertIndex),
                  fullMessage,
                  ...prev.slice(insertIndex)
                ];
              }
            });
            
            // Auto-scroll to bottom for new messages
            setTimeout(() => scrollToBottom(true), 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${session.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${session.user.id}))`,
        },
        (payload) => {
          console.log('📝 Message updated:', payload);
          const updatedMessage = payload.new as any;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === updatedMessage.id 
                ? { ...msg, ...updatedMessage }
                : msg
            )
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Messages subscription connected successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('⚠️ Messages subscription error - continuing with polling fallback');
        } else {
          console.log('💬 Messages subscription status:', status);
        }
      });

    // Enhanced typing indicator with broadcast
    const typingChannel = supabase
      .channel(`typing:${session.user.id}:${otherUserId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        console.log('⌨️ Typing update:', payload);
        const { is_typing, user_id } = payload.payload;
        if (user_id === otherUserId) {
          setIsOtherUserTyping(is_typing);
        }
      })
      .subscribe();

    setMessageSubscription(messagesChannel);
    setTypingSubscription(typingChannel);

    return () => {
      messagesChannel.unsubscribe();
      typingChannel.unsubscribe();
    };
  }, [session?.user?.id, otherUserId, scrollToBottom]);

  // Optimistic message sending
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending || !profile?.id) return;

    const messageContent = newMessage.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      content: messageContent,
      sender_id: profile.id,
      receiver_id: otherUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      edited_at: null,
      type: MessageType.TEXT,
      status: MessageStatus.SENDING,
      read_at: null,
      reply_to: replyingTo?.id,
      sender: {
        id: profile.id,
        name: profile.name || 'You',
        avatar_url: profile.avatar_url || null
      },
      receiver: {
        id: otherUserId,
        name: otherUserName,
        avatar_url: otherUserAvatar
      }
    };

    // Immediately add to messages (optimistic update)
    setMessages(prev => {
      // Optimistic messages are always newest, so append to end
      return [...prev, optimisticMessage];
    });

    // Clear input and scroll
    setNewMessage('');
    setReplyingTo(null);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      setSending(true);
      
      // Send to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: messageContent,
          sender_id: profile.id,
          receiver_id: otherUserId,
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          reply_to: replyingTo?.id || null,
          item_id: itemId || null,
          trip_id: tripId || null,
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Replace optimistic message with real message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...data, status: MessageStatus.SENT }
            : msg
        )
      );

    } catch (error: any) {
      console.error('💥 Error sending message:', error);
      
      // Check if it's a network error
      const isNetworkError = error?.message?.includes('Network request failed') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.code === 'NETWORK_ERROR';
      
      // Mark message as failed
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: MessageStatus.FAILED }
            : msg
        )
      );

      // Add to retry queue
      setMessageQueue(prev => [...prev, optimisticMessage]);
      
      const errorMessage = isNetworkError 
        ? 'Network connection failed. Please check your internet connection and try again.'
        : 'Failed to send message. Please try again.';
      
      Alert.alert(
        'Message Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => retryFailedMessage(tempId) }
        ]
      );
    } finally {
      setSending(false);
    }
  }, [newMessage, sending, profile, otherUserId, otherUserName, otherUserAvatar, replyingTo, itemId, tripId, scrollToBottom]);

  // Enhanced typing indicator
  const handleTyping = useCallback(async () => {
    if (!session?.user?.id || !typingSubscription) return;

    try {
      // Broadcast typing status
      await typingSubscription.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          is_typing: true,
          user_id: session.user.id
        }
      });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(async () => {
        if (typingSubscription) {
          await typingSubscription.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
              is_typing: false,
              user_id: session.user.id
            }
          });
        }
      }, 1500); // Reduced from 2000ms for more responsive UX
    } catch (error) {
      console.error('Error broadcasting typing status:', error);
    }
  }, [session?.user?.id, typingSubscription]);

  // Retry failed messages
  const retryFailedMessage = useCallback(async (messageId: string) => {
    const failedMessage = messages.find(m => m.id === messageId);
    if (!failedMessage || !profile?.id) return;

    // Update status to sending
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: MessageStatus.SENDING }
          : msg
      )
    );

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: failedMessage.content,
          sender_id: profile.id,
          receiver_id: otherUserId,
          type: failedMessage.type,
          status: MessageStatus.SENT,
          reply_to: failedMessage.reply_to || null,
          item_id: itemId || null,
          trip_id: tripId || null,
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Replace failed message with successful one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...data, status: MessageStatus.SENT }
            : msg
        )
      );

      // Remove from retry queue
      setMessageQueue(prev => prev.filter(m => m.id !== messageId));

    } catch (error) {
      console.error('Failed to retry message:', error);
      
      // Mark as failed again
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, status: MessageStatus.FAILED }
            : msg
        )
      );
    }
  }, [messages, profile, otherUserId, itemId, tripId]);

  // Image picker
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Fixed: Using new API instead of deprecated MediaTypeOptions.Images
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        allowsMultipleSelection: false,
        selectionLimit: 1, // Added: Explicit selection limit for better clarity
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setUploadingImage(true);
        
        await uploadAndSendImage(selectedAsset.uri, selectedAsset);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  }, []);

  // Optimized image upload with optimistic updates
  const uploadAndSendImage = useCallback(async (uri: string, asset: ImagePicker.ImagePickerAsset) => {
    if (!profile?.id) return;

    const tempId = `temp_img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic image message
    const optimisticMessage: Message = {
      id: tempId,
      content: '',
      sender_id: profile.id,
      receiver_id: otherUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      edited_at: null,
      type: MessageType.IMAGE,
      status: MessageStatus.SENDING,
      read_at: null,
      image_url: uri, // Use local URI temporarily
      metadata: {
        width: asset.width,
        height: asset.height,
        originalWidth: asset.width,
        originalHeight: asset.height
      },
      sender: {
        id: profile.id,
        name: profile.name || 'You',
        avatar_url: profile.avatar_url || null
      },
      receiver: {
        id: otherUserId,
        name: otherUserName,
        avatar_url: otherUserAvatar
      }
    };

    // Add optimistic message
    setMessages(prev => {
      // Optimistic messages are always newest, so append to end
      return [...prev, optimisticMessage];
    });

    setTimeout(() => scrollToBottom(true), 50);

    try {
      setSending(true);
      
      // Compress and resize image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { 
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.7,
        }
      );

      // Generate unique filename
      const fileName = `chat_image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const fileBytes = decode(base64);

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(fileName, fileBytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat_images')
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Send message to database
      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: '',
          sender_id: profile.id,
          receiver_id: otherUserId,
          type: MessageType.IMAGE,
          status: MessageStatus.SENT,
          image_url: publicUrlData.publicUrl,
          metadata: {
            width: manipResult.width,
            height: manipResult.height,
            fileSize: new Uint8Array(fileBytes).length,
            mimeType: 'image/jpeg',
            originalWidth: asset.width,
            originalHeight: asset.height
          },
          item_id: itemId || null,
          trip_id: tripId || null,
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (messageError) throw messageError;

      setMessages(prev => {
        const updated = [...prev, insertedMessage as Message].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return updated;
      });
      
      setReplyingTo(null);
      setTimeout(() => scrollToBottom(true), 50);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      // Mark as failed
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: MessageStatus.FAILED }
            : msg
        )
      );

      Alert.alert('Error', 'Failed to send image. Tap to retry.');
    } finally {
      setSending(false);
    }
  }, [profile, otherUserId, otherUserName, otherUserAvatar, itemId, tripId, scrollToBottom]);

  // Audio recording
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permissions to record audio');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingDurationRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start audio recording. Please try again.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    
    try {
      // Clear duration timer
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        await uploadAndSendFile(uri, MessageType.AUDIO);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    } finally {
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  }, [recording]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const uploadAndSendFile = useCallback(async (uri: string, type: MessageType) => {
    if (!profile?.id) return;

    try {
      setSending(true);
      
      // Read the file
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');
      
      const fileContents = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine file extension and content type
      let fileExt = 'm4a';
      let contentType = 'audio/m4a';
      let folder = 'chat_audio';
      

      const fileName = `chat_${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(folder)
        .upload(fileName, decode(fileContents), {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(folder)
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Send message with file URL
      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: '',
          sender_id: profile.id,
          receiver_id: otherUserId,
          type,
          status: MessageStatus.SENT,
          audio_url: type === MessageType.AUDIO ? publicUrlData.publicUrl : undefined,
          image_url: type === MessageType.IMAGE ? publicUrlData.publicUrl : undefined,
          reply_to: replyingTo?.id || null,
          item_id: itemId || null,
          trip_id: tripId || null,
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, name, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, name, avatar_url)
        `)
        .single();

      if (messageError) throw messageError;

      setMessages(prev => {
        const updated = [...prev, insertedMessage as Message].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return updated;
      });
      
      setReplyingTo(null);
      setTimeout(() => scrollToBottom(true), 50);
    } catch (error: any) {
      console.error('Error sending file:', error);
      Alert.alert('Error', `Failed to send file: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  }, [profile, otherUserId, replyingTo, itemId, tripId, scrollToBottom]);

  // Group messages by date and sort them
  const renderDateHeader = (date: string) => {
    const messageDate = new Date(date);
    let dateText = format(messageDate, 'MMMM d, yyyy');
    
    if (isToday(messageDate)) {
      dateText = 'Today';
    } else if (isYesterday(messageDate)) {
      dateText = 'Yesterday';
    }

    return (
      <View style={enhancedStyles.modernDateHeader}>
        <Text style={enhancedStyles.modernDateHeaderText}>{dateText}</Text>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.sender_id === session?.user.id;
    return (
        <MessageItem
          item={item}
          isSent={isSent}
          otherUserAvatar={otherUserAvatar}
          onImagePress={handleImagePress}
          editingMessage={editingMessage}
          onReply={(message) => {
            setReplyingTo(message);
            inputRef.current?.focus();
          }}
          onLongPress={(message) => {
            setSelectedMessage(message);
            setShowMessageOptions(true);
          }}
        />
    );
  };

  // Initialize screen and setup
  useEffect(() => {
    console.log('ChatScreen mounted with params:', route.params);
    console.log('Session:', session);
    console.log('Profile:', profile);

    if (!session?.user?.id) {
      console.log('No session found, showing loading...');
      return;
    }

    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <TouchableOpacity 
          style={styles.headerTitle}
          onPress={() => {/* Navigate to profile */}}
        >
          <View style={styles.headerAvatar}>
            {otherUserAvatar ? (
              <Image
                source={{ uri: otherUserAvatar }}
                style={styles.headerAvatarImage}
              />
            ) : (
              <View style={[styles.headerAvatarImage, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUserName}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </TouchableOpacity>
      ),
      headerStyle: Platform.select({
        ios: {
          backgroundColor: colors.background,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        android: {
          backgroundColor: colors.background,
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
      }),
    });

    console.log('Starting to fetch messages...');
    fetchMessages();
    setupRealtimeSubscription();

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [navigation, otherUserName, otherUserAvatar, session, profile]);

  const markMessagesAsRead = useCallback(async () => {
    if (!session?.user?.id || !otherUserId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          status: MessageStatus.READ,
          read_at: new Date().toISOString()
        })
        .match({ 
          receiver_id: session.user.id,
          sender_id: otherUserId,
          status: MessageStatus.DELIVERED
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [session?.user?.id, otherUserId]);

  // Call markMessagesAsRead when messages are viewed
  useEffect(() => {
    markMessagesAsRead();
  }, [messages, markMessagesAsRead]);

  const fetchMessages = async () => {
    if (!session?.user?.id) {
      console.log('No session found, showing loading...');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching messages between users:', session.user.id, 'and', otherUserId);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
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
        .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${session.user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }

      console.log('Messages fetched:', data?.length || 0);
      if (data) {
        setMessages(data);
        // Mark messages as read after loading
        markMessagesAsRead();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: MessageStatus) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ status })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      ));
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  };

  const addReaction = async (messageId: string, reaction: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: session?.user?.id,
          reaction,
        });

      if (error) throw error;

      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          reactions[reaction] = (reactions[reaction] || 0) + 1;
          return { ...msg, reactions };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      setDeletingMessageId(messageId);
      
      // First, show confirmation dialog
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setDeletingMessageId(null)
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Soft delete in database
                const { error } = await supabase
                  .from('messages')
                  .update({ 
                    deleted_at: new Date().toISOString(),
                    content: 'This message was deleted',
                    type: MessageType.TEXT // Change type to text for deleted messages
                  })
                  .eq('id', messageId);

                if (error) throw error;

                // Update local state
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId 
                    ? { 
                        ...msg, 
                        deleted_at: new Date().toISOString(),
                        content: 'This message was deleted',
                        type: MessageType.TEXT
                      } 
                    : msg
                ));

                // Show success feedback
                Alert.alert('Success', 'Message deleted successfully');
              } catch (error) {
                console.error('Error deleting message:', error);
                Alert.alert('Error', 'Failed to delete message. Please try again.');
              } finally {
                setDeletingMessageId(null);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in delete confirmation:', error);
      setDeletingMessageId(null);
    }
  };

  // Add read receipts subscription
  useEffect(() => {
    if (!session?.user?.id || !otherUserId) return;

    const subscription = supabase
      .channel(`read_receipts:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${session.user.id}`,
        },
        (payload) => {
          // Update message status in local state
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.id === payload.new.id
                ? { ...msg, status: payload.new.status }
                : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session?.user?.id, otherUserId]);

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!isOtherUserTyping) return null;

    return (
      <Animated.View
        entering={FadeInDown}
        exiting={FadeInDown}
        style={enhancedStyles.modernTypingIndicator}
      >
        <View style={enhancedStyles.modernTypingBubble}>
          <Text style={styles.typingText}>
            {otherUserName} is typing
          </Text>
          <View style={styles.typingDots}>
            <Animated.View style={styles.typingDot} />
            <Animated.View style={styles.typingDot} />
            <Animated.View style={styles.typingDot} />
          </View>
        </View>
      </Animated.View>
    );
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!session?.user?.id) return;

    try {
      const { data: updatedMessage, error } = await supabase
        .from('messages')
        .update({ 
          content: newContent,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, ...updatedMessage } : msg
      ));
      setEditingMessage(null);
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message');
    }
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={enhancedStyles.modernContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={enhancedStyles.modernMessagesContainer}>
          {showSearch && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search messages..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity onPress={() => setShowSearch(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={([date]) => date}
            renderItem={({ item: [date, messages] }) => (
              <View>
                {renderDateHeader(date)}
                {messages.map((message: Message) => (
                  <Swipeable
                    key={message.id}
                    renderRightActions={() => (
                      <View style={styles.swipeActions}>
                        {!message.deleted_at && (
                          <>
                            <TouchableOpacity
                              style={[styles.swipeAction, styles.replyAction]}
                              onPress={() => {
                                setReplyingTo(message);
                                inputRef.current?.focus();
                              }}
                            >
                              <Ionicons name="arrow-undo" size={20} color="#fff" />
                            </TouchableOpacity>
                            {message.sender_id === session?.user.id && (
                              <TouchableOpacity
                                style={[styles.swipeAction, styles.deleteAction]}
                                onPress={() => deleteMessage(message.id)}
                                disabled={deletingMessageId === message.id}
                              >
                                {deletingMessageId === message.id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <Ionicons name="trash" size={20} color="#fff" />
                                )}
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  >
                    {renderMessage({ item: message })}
                  </Swipeable>
                ))}
              </View>
            )}
            contentContainerStyle={[
              styles.messagesList,
              showEmojiPicker && { paddingBottom: 250 }
            ]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            onEndReached={() => {}}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={enhancedStyles.modernEmptyContainer}>
                <View style={enhancedStyles.modernEmptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={64} color="#9CA3AF" />
                </View>
                <Text style={enhancedStyles.modernEmptyTitle}>No messages yet</Text>
                <Text style={enhancedStyles.modernEmptySubtitle}>
                  Start a conversation with {otherUserName}
                </Text>
              </View>
            }
          />
          {renderTypingIndicator()}
        </View>

        {/* Enhanced Bottom Container with better design */}
        <View style={styles.bottomContainer}>
          {/* Reply indicator */}
          {replyingTo && (
            <Animated.View 
              entering={FadeInDown.springify()}
              style={styles.replyIndicator}
            >
              <View style={styles.replyContent}>
                <Ionicons name="arrow-undo" size={16} color={colors.primary} />
                <Text style={styles.replyingToText} numberOfLines={1}>
                  Replying to: {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={styles.cancelReplyButton}
              >
                <Ionicons name="close" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Editing indicator */}
            {editingMessage && (
            <Animated.View 
              entering={FadeInDown.springify()}
              style={styles.editingIndicator}
            >
              <View style={styles.editingContent}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={styles.editingText}>Editing message</Text>
              </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMessage(null);
                    setNewMessage('');
                  }}
                style={styles.cancelEditButton}
                >
                <Ionicons name="close" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
            </Animated.View>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <Animated.View 
              entering={FadeInDown.springify()}
              style={styles.recordingIndicator}
            >
              <View style={styles.recordingContent}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  Recording... {formatDuration(recordingDuration)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={stopRecording}
                style={styles.stopRecordingButton}
              >
                <Ionicons name="stop-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            </Animated.View>
          )}
          
          {/* Enhanced Input Container */}
          <View style={enhancedStyles.modernInputContainer}>
            <TouchableOpacity 
              style={enhancedStyles.modernMediaButton}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="image" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
            
            <View style={enhancedStyles.modernInputWrapper}>
            <TextInput
              ref={inputRef}
              style={enhancedStyles.modernInput}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                handleTyping();
              }}
                placeholder={editingMessage ? "Edit message..." : "Type a message..."}
              placeholderTextColor={colors.text.secondary}
                multiline={true}
              maxLength={1000}
              onFocus={() => setShowEmojiPicker(false)}
            />
            
              {!newMessage.trim() && !editingMessage && (
                <View style={styles.inputActions}>
              {Platform.OS !== 'web' && Audio.Recording && (
                <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={startRecording}
                >
                  <Ionicons 
                        name="mic" 
                        size={22} 
                        color={colors.primary} 
                  />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowEmojiPicker(prev => !prev);
                }}
              >
                <Ionicons 
                  name={showEmojiPicker ? "keypad" : "happy"} 
                      size={22} 
                      color={colors.primary} 
                />
              </TouchableOpacity>
                </View>
              )}
            </View>

              {(newMessage.trim() || editingMessage) && (
              <Animated.View entering={FadeInDown.springify()}>
                <TouchableOpacity
                  style={enhancedStyles.modernSendButton}
                  onPress={() => {
                    if (editingMessage) {
                      editMessage(editingMessage.id, newMessage.trim());
                    } else {
                      sendMessage();
                    }
                  }}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons 
                      name="send" 
                      size={20} 
                      color={colors.white} 
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
              )}
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Recording... {formatDuration(recordingDuration)}
              </Text>
            </View>
          )}

          {showEmojiPicker && (
            <View style={styles.emojiPickerContainer}>
              <EmojiSelector
                onEmojiSelected={emoji => {
                  setNewMessage(prev => prev + emoji);
                  handleTyping();
                }}
                showSearchBar={false}
                showHistory={true}
                showSectionTitles={false}
                columns={8}
                category={undefined}
              />
            </View>
          )}
        </View>

        {/* Message options modal */}
        <Modal
          visible={showMessageOptions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMessageOptions(false)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowMessageOptions(false)}
          />
          <View style={styles.messageOptionsContainer}>
            <Text style={styles.messageOptionsTitle}>Message Options</Text>
            
            <View style={styles.reactionOptions}>
              {['❤️', '😂', '😮', '😢', '👍', '👎'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionOption}
                  onPress={() => {
                    if (selectedMessage) {
                      addReaction(selectedMessage.id, emoji);
                      setShowMessageOptions(false);
                    }
                  }}
                >
                  <Text style={styles.reactionOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.messageOption}
              onPress={() => {
                if (selectedMessage) {
                  setReplyingTo(selectedMessage);
                  inputRef.current?.focus();
                  setShowMessageOptions(false);
                }
              }}
            >
              <Ionicons name="arrow-undo" size={20} color="#666" />
              <Text style={styles.messageOptionText}>Reply</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.messageOption}
              onPress={() => {
                if (selectedMessage) {
                  // Implement forward message
                  setShowMessageOptions(false);
                }
              }}
            >
              <Ionicons name="share" size={20} color="#666" />
              <Text style={styles.messageOptionText}>Forward</Text>
            </TouchableOpacity>
            
            {selectedMessage?.sender_id === session?.user.id && (
              <>
                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => {
                    if (selectedMessage) {
                      setEditingMessage(selectedMessage);
                      setNewMessage(selectedMessage.content);
                      inputRef.current?.focus();
                      setShowMessageOptions(false);
                    }
                  }}
                >
                  <Ionicons name="pencil" size={20} color="#666" />
                  <Text style={styles.messageOptionText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.messageOption}
                  onPress={() => {
                    if (selectedMessage) {
                      deleteMessage(selectedMessage.id);
                      setShowMessageOptions(false);
                    }
                  }}
                >
                  <Ionicons name="trash" size={20} color={colors.error} />
                  <Text style={[styles.messageOptionText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity
              style={styles.messageOption}
              onPress={() => setShowMessageOptions(false)}
            >
              <Text style={[styles.messageOptionText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messagesContainer: {
    flex: 1,
  },
  bottomContainer: {
    width: '100%',
    backgroundColor: colors.white,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    zIndex: 1,
  },
  mediaButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  emojiPickerContainer: {
    height: 250,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.background,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateHeaderText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    ...shadows.small,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    marginRight: spacing.sm,
  },
  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: typography.sizes.md,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: colors.text.primary,
  },
  headerStatus: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  messagesList: {
    padding: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xs,
  },
  sentMessageContainer: {
    justifyContent: 'flex-end',
  },
  receivedMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: spacing.sm,
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.small,
    elevation: 2,
  },
  sentMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },
  receivedMessage: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: borderRadius.sm,
  },
  messageText: {
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * 1.4,
    textAlign: 'left',
  },
  sentText: {
    color: colors.white,
  },
  receivedText: {
    color: colors.text.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    color: colors.text.secondary,
    marginRight: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingContainer: {
    padding: spacing.sm,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
  },
  typingBubble: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.secondary,
    marginHorizontal: 2,
    opacity: 0.6,
  },
  typingDotMiddle: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    minHeight: 20,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  inputRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  sendButton: {
    marginLeft: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    minWidth: 120,
  },
  sentAudioMessage: {
    backgroundColor: colors.primary,
  },
  receivedAudioMessage: {
    backgroundColor: colors.background,
  },
  audioWaveform: {
    flex: 1,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sentAudioWaveform: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  receivedAudioWaveform: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  audioWaveformBar: {
    width: 3,
    height: 8,
    backgroundColor: 'currentColor',
    borderRadius: 1.5,
  },
  recordingButton: {
    backgroundColor: colors.error + '20',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.error + '10',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: spacing.sm,
  },
  recordingText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  reactionEmoji: {
    fontSize: typography.sizes.xs,
    marginRight: spacing.xs,
  },
  reactionCount: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
  },
  replyAction: {
    backgroundColor: colors.primary,
  },
  deleteAction: {
    backgroundColor: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  messageOptionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.large,
  },
  messageOptionsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600' as TextStyle['fontWeight'],
    marginBottom: spacing.xl,
    textAlign: 'center',
    color: colors.text.primary,
  },
  reactionOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  reactionOption: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.round,
    ...shadows.small,
  },
  reactionOptionText: {
    fontSize: typography.sizes.xl,
  },
  messageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  messageOptionText: {
    fontSize: typography.sizes.md,
    marginLeft: spacing.md,
    color: colors.text.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerButton: {
    padding: spacing.sm,
    marginHorizontal: 2,
  },
  replyContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  replyText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
  },
  editingText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  editedText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  editingMessage: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  imageWrapper: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  imageLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  imageErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  imageErrorText: {
    marginTop: 8,
    color: colors.text.secondary,
    fontSize: 12,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  deletedMessage: {
    backgroundColor: colors.background,
    opacity: 0.7,
  },
  deletedMessageText: {
    fontStyle: 'italic',
    color: colors.text.secondary,
  },
  // Enhanced input area styles
  replyIndicator: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyingToText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cancelReplyButton: {
    padding: spacing.xs,
  },
  editingIndicator: {
    backgroundColor: '#FFF3CD',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#FFE69C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cancelEditButton: {
    padding: spacing.xs,
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stopRecordingButton: {
    padding: spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    minWidth: 120,
  },
  audioInfo: {
    marginLeft: spacing.sm,
  },
  audioText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  audioDuration: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  failedMessage: {
    backgroundColor: colors.error + '20',
  },
  editingMessageBubble: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sentMessageWrapper: {
    alignSelf: 'flex-end',
  },
  receivedMessageWrapper: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  replyBar: {
    width: 2,
    height: '100%',
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  editedIndicator: {
    fontSize: 10,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
});

// Enhanced Chat UI Styles for better organization
const enhancedStyles = StyleSheet.create({
  // Modern container styling
  modernContainer: {
    flex: 1,
    backgroundColor: '#FAFBFC', // Professional light background
  },
  modernMessagesContainer: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  
  // Enhanced message wrapper
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    width: '100%',
  },
  sentMessageWrapper: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  receivedMessageWrapper: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  
  // Professional message bubble containers
  messageBubbleContainer: {
    flex: 1,
    maxWidth: '75%', // Reduced from 85% for better balance
  },
  sentBubbleContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  receivedBubbleContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  
  // Message content container for proper text wrapping
  messageContentContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  
  // Professional bubble design
  modernBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginVertical: 2,
    minWidth: 40,
  },
  modernSentBubble: {
    backgroundColor: '#007AFF', // Professional iOS blue
    borderBottomRightRadius: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.15,
  },
  modernReceivedBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: '#E8EAED',
  },
  
  // Enhanced avatar container
  avatarContainer: {
    marginRight: 12,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modernAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#F1F3F4',
  },
  
  // Enhanced input area
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EAED',
    minHeight: 68,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  modernInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8EAED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    minHeight: 48,
    maxHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  modernInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1F2937',
    paddingVertical: 8,
    minHeight: 28,
    maxHeight: 100,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  modernSendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  modernMediaButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EAED',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  
  // Enhanced message content
  modernMessageText: {
    fontSize: 15, // Reduced from 16 for more compact messages
    lineHeight: 21, // Increased from 20 for better text flow and wrapping
    fontWeight: '400',
    letterSpacing: 0.1,
    width: '100%', // Ensure full width usage for proper wrapping
    textAlign: 'left',
    includeFontPadding: false,
  },
  modernSentText: {
    color: '#FFFFFF',
  },
  modernReceivedText: {
    color: '#1F2937',
  },
  
  // Enhanced message footer
  modernMessageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6, // Reduced from 8 for more compact footer
    paddingTop: 3, // Reduced from 4
  },
  modernTimestamp: {
    fontSize: 11, // Reduced from 12 for smaller timestamps
    fontWeight: '500',
    marginRight: 6,
    letterSpacing: 0.2,
  },
  modernSentTimestamp: {
    color: 'rgba(255,255,255,0.8)',
  },
  modernReceivedTimestamp: {
    color: '#6B7280',
  },
  
  // Enhanced date headers
  modernDateHeader: {
    alignItems: 'center',
    marginVertical: 24,
  },
  modernDateHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  
  // Enhanced typing indicator
  modernTypingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  modernTypingBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: '65%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: '#E8EAED',
  },
  
  // Professional empty state
  modernEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modernEmptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  modernEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modernEmptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Professional search container
  modernSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  modernSearchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8F9FA',
    borderRadius: 22,
    paddingHorizontal: 16,
    marginRight: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  
  // Professional message options modal
  modernModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modernMessageOptionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  modernOptionsHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modernOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1F2937',
  },
  
  // New wrapper for fixing text wrapping
  messageBubbleWrapper: {
    flex: 1,
    maxWidth: '70%', // Reduced from 80% for more compact messages
    alignSelf: 'flex-start',
  },
});

export default ChatScreen;