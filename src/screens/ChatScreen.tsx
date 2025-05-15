import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Keyboard,
  Dimensions,
  ImageStyle,
  TextStyle,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { chatService } from '../services/chatService';
import { Message, MessageType, Reaction } from '../types/chat';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import Animated, { 
  FadeInDown, 
  Layout, 
  SlideInRight, 
  SlideInLeft,
  FadeIn 
} from 'react-native-reanimated';
import { MessagesStackScreenProps } from '../navigation/types';
import { colors, typography, spacing, shadows, borderRadius } from '../theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessagesStackParamList } from '../navigation/types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import EmojiSelector from 'react-native-emoji-selector';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useTheme } from '../contexts/ThemeContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { TabParamList } from '../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read'
}

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
}

interface ImageUploadResult {
  width: number;
  height: number;
  uri: string;
  base64?: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ item, isSent, otherUserAvatar, onImagePress, editingMessage }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
  const isDeleted = item.deleted_at !== null;
  const isEditing = editingMessage?.id === item.id;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleAudioPress = async () => {
    if (!item.audio_url) return;

    try {
      setIsLoading(true);
      
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.playAsync();
            setIsPlaying(true);
          } else {
            // If sound is not loaded, create a new one
            await sound.unloadAsync();
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: item.audio_url },
              { shouldPlay: true }
            );
            setSound(newSound);
            setIsPlaying(true);

            newSound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                setIsPlaying(false);
              }
            });
          }
        }
      } else {
        // Create new sound
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: item.audio_url },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio message');
    } finally {
      setIsLoading(false);
    }
  };

  if (isDeleted) return null;

  const handleImagePress = () => {
    if (item.image_url) {
      onImagePress(item.image_url);
    }
  };

  const renderImage = () => {
    if (!item.image_url) return null;

    return (
      <View style={styles.imageWrapper}>
        <TouchableOpacity 
          onPress={handleImagePress}
          activeOpacity={0.9}
          style={styles.imageContainer}
        >
          {imageLoading && (
            <View style={styles.imageLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          {!imageError ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.messageImage}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={(error) => {
                console.error('Error loading image:', error.nativeEvent.error);
                console.log('Failed image URL:', item.image_url);
                setImageError(true);
                setImageLoading(false);
              }}
            />
          ) : (
            <View style={styles.imageErrorContainer}>
              <Ionicons name="image-outline" size={32} color={colors.text.secondary} />
              <Text style={styles.imageErrorText}>Failed to load image</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setImageError(false);
                  setImageLoading(true);
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderAudioMessage = () => {
    if (item.type !== MessageType.AUDIO || !item.audio_url) return null;

    return (
      <TouchableOpacity 
        style={[
          styles.audioMessage,
          isSent ? styles.sentAudioMessage : styles.receivedAudioMessage
        ]}
        onPress={handleAudioPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isSent ? colors.white : colors.primary} />
        ) : (
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={24} 
            color={isSent ? colors.white : colors.primary} 
          />
        )}
        <View style={[
          styles.audioWaveform,
          isSent ? styles.sentAudioWaveform : styles.receivedAudioWaveform
        ]}>
          <View style={styles.audioWaveformBar} />
          <View style={[styles.audioWaveformBar, { height: 12 }]} />
          <View style={styles.audioWaveformBar} />
          <View style={[styles.audioWaveformBar, { height: 16 }]} />
          <View style={styles.audioWaveformBar} />
          <View style={[styles.audioWaveformBar, { height: 12 }]} />
          <View style={styles.audioWaveformBar} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageContent = () => {
    if (item.type === MessageType.IMAGE) {
      return renderImage();
    }
    
    if (item.type === MessageType.AUDIO) {
      return renderAudioMessage();
    }

    return (
      <Text style={[
        styles.messageText,
        isSent ? styles.sentText : styles.receivedText,
      ]}>
        {item.content}
        {item.edited_at && (
          <Text style={styles.editedText}> (edited)</Text>
        )}
      </Text>
    );
  };

  return (
    <Animated.View
      entering={isSent ? SlideInRight : SlideInLeft}
      layout={Layout.springify()}
      style={[
        styles.messageContainer,
        isSent ? styles.sentMessageContainer : styles.receivedMessageContainer
      ]}
    >
      {!isSent && (
        <View style={styles.messageAvatar}>
          {otherUserAvatar ? (
            <Image
              source={{ uri: otherUserAvatar }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color={colors.text.secondary} />
            </View>
          )}
        </View>
      )}
      
      <Animated.View 
        entering={FadeIn}
        style={[
          styles.messageBubble,
          isSent ? styles.sentMessage : styles.receivedMessage,
          isEditing && styles.editingMessage,
          shadows.small
        ]}
      >
        {item.reply_to && (
          <View style={styles.replyContainer}>
            <Text style={styles.replyText} numberOfLines={1}>
              {item.reply_to}
            </Text>
          </View>
        )}
        
        {renderMessageContent()}

        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>{timeAgo}</Text>
          {isSent && (
            <View style={styles.messageStatus}>
              {item.status === MessageStatus.READ && (
                <Ionicons name="checkmark-done" size={16} color={colors.primary} />
              )}
              {item.status === MessageStatus.DELIVERED && (
                <Ionicons name="checkmark-done" size={16} color={colors.text.secondary} />
              )}
              {item.status === MessageStatus.SENT && (
                <Ionicons name="checkmark" size={16} color={colors.text.secondary} />
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
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
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingDurationRef = useRef<NodeJS.Timeout>();

  const handleImagePress = useCallback((uri: string) => {
    navigation.navigate('Messages', {
      screen: 'ImageViewer',
      params: { uri }
    });
  }, [navigation]);

  // Enhanced scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Scroll to bottom when keyboard appears
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      scrollToBottom
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [scrollToBottom]);

  // Group messages by date and sort them
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  // Sort messages within each group by creation time (oldest first)
  Object.keys(groupedMessages).forEach(dateKey => {
    groupedMessages[dateKey].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  // Sort date groups in ascending order (oldest first)
  const sortedDateGroups = Object.entries(groupedMessages)
    .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime());

  const renderDateHeader = (date: string) => {
    const messageDate = new Date(date);
    let dateText = format(messageDate, 'MMMM d, yyyy');
    
    if (isToday(messageDate)) {
      dateText = 'Today';
    } else if (isYesterday(messageDate)) {
      dateText = 'Yesterday';
    }

    return (
      <View style={styles.dateHeader}>
        <Text style={styles.dateHeaderText}>{dateText}</Text>
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
      />
    );
  };

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

  const setupRealtimeSubscription = () => {
    if (!session?.user?.id) return;

    const setupSubscription = async () => {
      // Unsubscribe from existing channel if any
      if (messageSubscription) {
        await messageSubscription.unsubscribe();
      }

      // Create new subscription
      const subscription = supabase
        .channel('messages_channel')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `or(and(sender_id.eq.${session.user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${session.user.id}))`,
          },
          (payload) => {
            console.log('Real-time update:', payload);
            // Refresh messages when there are updates
            fetchMessages();
          }
        )
        .subscribe();

      setMessageSubscription(subscription);
    };

    setupSubscription();

    // Cleanup function
    return () => {
      if (messageSubscription) {
        messageSubscription.unsubscribe();
      }
    };
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

  const handleTyping = useCallback(async () => {
    if (!session?.user?.id || !otherUserId) return;

    try {
      // Send typing status to other user
      await supabase
        .from('typing_status')
        .upsert({
          user_id: session.user.id,
          other_user_id: otherUserId,
          is_typing: true,
          updated_at: new Date().toISOString()
        });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to clear typing status
      typingTimeoutRef.current = setTimeout(async () => {
        await supabase
          .from('typing_status')
          .upsert({
            user_id: session.user.id,
            other_user_id: otherUserId,
            is_typing: false,
            updated_at: new Date().toISOString()
          });
      }, 3000);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [session?.user?.id, otherUserId]);

  // Update the typing status subscription
  useEffect(() => {
    if (!session?.user?.id || !otherUserId) return;

    const channel = supabase
      .channel(`typing_status:${otherUserId}`)
      .on(
        'broadcast',
        {
          event: 'typing_status',
        },
        (payload) => {
          console.log('Received typing status:', payload);
          const typingStatus = payload.payload as TypingStatus;
          if (typingStatus) {
            setIsOtherUserTyping(typingStatus.is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session?.user?.id, otherUserId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !profile?.id) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim(),
          sender_id: profile.id,
          receiver_id: otherUserId,
          type: MessageType.TEXT,
          read_at: null,
          reply_to: replyingTo?.id || undefined,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update messages state with the new message
      setMessages(prev => {
        const newMessages = [...prev, data];
        // Sort messages by creation time (newest first)
        return newMessages.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      
      setNewMessage('');
      setReplyingTo(null);
      Keyboard.dismiss();
      scrollToBottom(); // Ensure scroll after sending
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        allowsMultipleSelection: false,
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
  };

  const uploadAndSendImage = async (uri: string, asset: ImagePicker.ImagePickerAsset) => {
    if (!session?.user?.id || !profile?.id) return;

    try {
      setSending(true);
      console.log('Starting image upload...');

      // 1. Compress and resize image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 1200 } },
        ],
        { 
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.7,
        }
      );

      // 2. Generate unique filename
      const fileName = `chat_image_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;

      // 3. Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. Convert base64 to Uint8Array
      const fileBytes = decode(base64);
      const fileSize = new Uint8Array(fileBytes).length;

      // 5. Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(fileName, fileBytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // 6. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat_images')
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // 7. Create message payload
      const messageData: MessageData = {
        content: '',
        sender_id: profile.id,
        receiver_id: otherUserId,
        type: MessageType.IMAGE,
        image_url: publicUrlData.publicUrl,
        read_at: null,
        metadata: {
          width: manipResult.width,
          height: manipResult.height,
          fileSize,
          mimeType: 'image/jpeg',
          originalWidth: asset.width,
          originalHeight: asset.height
        }
      };

      // 8. Insert message
      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (messageError) {
        console.error('Message error:', messageError);
        throw new Error(`Failed to save message: ${messageError.message}`);
      }

      setMessages(prev => [insertedMessage, ...prev]);
      scrollToBottom();
      Keyboard.dismiss();

      console.log('Image uploaded and message sent.');
    } catch (error: any) {
      console.error('Error in uploadAndSendImage:', error);
      Alert.alert(
        'Error',
        `Failed to send image: ${error.message || 'Unknown error'}`
      );
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!Audio.Recording) {
        console.log('Audio recording is not available on this platform');
        Alert.alert('Not Available', 'Audio recording is not supported on this device');
        return;
      }

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
  };

  const stopRecording = async () => {
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
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadAndSendFile = async (uri: string, type: MessageType) => {
    if (!session?.user?.id || !profile?.id) return;

    try {
      setSending(true);
      
      // Read the file
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');
      
      const fileContents = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine file extension and content type
      let fileExt = 'jpg';
      let contentType = 'image/jpeg';
      let folder = 'chat_images';
      
      if (type === MessageType.AUDIO) {
        fileExt = 'm4a';
        contentType = 'audio/m4a';
        folder = 'chat_audio';
      } else if (uri.includes('.png')) {
        fileExt = 'png';
        contentType = 'image/png';
      } else if (uri.includes('.gif')) {
        fileExt = 'gif';
        contentType = 'image/gif';
      }

      const fileName = `chat_${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from(folder)
        .upload(filePath, decode(fileContents), {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(folder)
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Send message with file URL
      const newMessagePayload: Partial<Message> = {
        content: '',
        sender_id: profile.id,
        receiver_id: otherUserId,
        type,
        status: MessageStatus.SENT,
        audio_url: type === MessageType.AUDIO ? publicUrlData.publicUrl : undefined,
        image_url: type === MessageType.IMAGE ? publicUrlData.publicUrl : undefined,
        reply_to: replyingTo?.id || undefined,
      };

      const { data: insertedMessage, error: messageError } = await supabase
        .from('messages')
        .insert(newMessagePayload)
        .select()
        .single();

      if (messageError) throw messageError;

      setMessages(prev => [insertedMessage as Message, ...prev]);
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (error: any) {
      console.error('Error sending file:', error);
      Alert.alert(
        'Error',
        `Failed to send file: ${error.message || 'Unknown error'}`
      );
    } finally {
      setSending(false);
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
        style={styles.typingIndicator}
      >
        <View style={styles.typingBubble}>
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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.messagesContainer}>
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
            data={sortedDateGroups}
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
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            onEndReached={scrollToBottom}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#666" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a conversation with {otherUserName}
                </Text>
              </View>
            }
          />
          {renderTypingIndicator()}
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.inputContainer}>
            {editingMessage && (
              <View style={styles.editingContainer}>
                <Text style={styles.editingText}>Editing message</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingMessage(null);
                    setNewMessage('');
                  }}
                >
                  <Ionicons name="close" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.mediaButton}
              onPress={pickImage}
            >
              <Ionicons name="image" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
            
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                handleTyping();
              }}
              placeholder={editingMessage ? "Edit message..." : "Message..."}
              placeholderTextColor={colors.text.secondary}
              multiline={false}
              maxLength={1000}
              onFocus={() => setShowEmojiPicker(false)}
            />
            
            <View style={styles.inputRightButtons}>
              {Platform.OS !== 'web' && Audio.Recording && (
                <TouchableOpacity 
                  style={[
                    styles.actionButton,
                    isRecording && styles.recordingButton
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Ionicons 
                    name={isRecording ? "stop-circle" : "mic"} 
                    size={24} 
                    color={isRecording ? colors.error : colors.text.secondary} 
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
                  size={24} 
                  color={colors.text.secondary} 
                />
              </TouchableOpacity>

              {(newMessage.trim() || editingMessage) && (
                <TouchableOpacity
                  style={styles.sendButton}
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
                    <Text style={styles.sendButtonText}>
                      {editingMessage ? 'Save' : 'Send'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
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
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
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
    paddingHorizontal: spacing.sm,
    maxHeight: 40,
    backgroundColor: colors.background,
    borderRadius: borderRadius.round,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.primary,
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
});

export default ChatScreen;