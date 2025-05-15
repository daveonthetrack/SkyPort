import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { CompositeNavigationProp, useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeStackParamList, TabParamList, MessagesStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCallback } from 'react';
import { CommonActions } from '@react-navigation/native';
import { MessageType, MessageStatus } from '../types/chat';

type RouteParams = {
  itemId: string | number;
  itemTitle?: string;
  origin?: string;
  destination?: string;
  size?: string;
  ownerName?: string;
  ownerId?: string;
  imageUrl?: string;
  item?: {
    id: string | number;
    title: string;
    pickup_location: string;
    destination: string;
    size: string;
    image_url?: string;
    user_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  trip?: any;
};

type PickupDetailsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'PickupDetails'>,
  BottomTabNavigationProp<TabParamList>
>;

type PickupDetailsScreenRouteProp = RouteProp<{
  PickupDetails: RouteParams;
}, 'PickupDetails'>;

type TabType = 'details' | 'chat' | 'status';

export default function PickupDetailsScreen() {
  const navigation = useNavigation<PickupDetailsScreenNavigationProp>();
  const route = useRoute<PickupDetailsScreenRouteProp>();
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [itemStatus, setItemStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  
  const {
    itemId,
    item,
    trip,
  } = route.params;

  // Extract item details from either direct params or item object
  const itemTitle = item?.title || route.params.itemTitle || 'Item';
  const origin = item?.pickup_location || route.params.origin || 'Unknown';
  const destination = item?.destination || route.params.destination || 'Unknown';
  const size = item?.size || route.params.size || 'Unknown';
  const ownerId = item?.user_id || route.params.ownerId;
  const [ownerName, setOwnerName] = useState<string>('Item Owner');
  const imageUrl = item?.image_url || route.params.imageUrl;

  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<Date | null>(null);

  // Fetch owner's name when component mounts
  useEffect(() => {
    const fetchOwnerName = async () => {
      if (!ownerId) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', ownerId)
          .single();

        if (error) throw error;
        
        if (data?.name) {
          setOwnerName(data.name);
        }
      } catch (error) {
        console.error('Error fetching owner name:', error);
      }
    };

    fetchOwnerName();
  }, [ownerId]);

  // Fetch item status on mount
  useEffect(() => {
    fetchItemStatus();
  }, []);

  // Also fetch item status whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('PickupDetailsScreen focused - fetching latest item status');
      fetchItemStatus();
      return () => {
        // cleanup if needed
      };
    }, [itemId])
  );

  const fetchItemStatus = async () => {
    try {
      if (!itemId) {
        console.error('No itemId provided');
        Alert.alert('Error', 'Item information is missing. Please try again.');
        navigation.goBack();
        return;
      }
      
      console.log('Fetching status for item:', itemId);
      const { data, error } = await supabase
        .from('items')
        .select('status, accepted_by, pickup_date, estimated_delivery_date, updated_at')
        .eq('id', itemId)
        .single();
      
      if (error) {
        console.error('Error fetching item status:', error);
        throw error;
      }
      
      if (data) {
        console.log('Item status fetched:', data);
        setItemStatus(data.status);
        
        // Set dates if they exist
        if (data.pickup_date) {
          setPickupDate(new Date(data.pickup_date));
        }
        if (data.estimated_delivery_date) {
          setEstimatedDeliveryDate(new Date(data.estimated_delivery_date));
        }
        
        // If the item status has changed significantly, show an alert
        if (data.status === 'delivered' && itemStatus !== 'delivered') {
          Alert.alert(
            'Item Delivered',
            'This item has been marked as delivered.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error fetching item status:', error);
      Alert.alert(
        'Error',
        'Failed to fetch item status. Please try again.',
        [
          {
            text: 'Retry',
            onPress: fetchItemStatus
          },
          {
            text: 'Go Back',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Not set';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePickupItem = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to pick up items.');
      return;
    }

    Alert.alert(
      'Confirm Pickup',
      `Are you sure you want to pick up this item?\n\n` +
      `Item: ${itemTitle}\n` +
      `From: ${origin}\n` +
      `To: ${destination}\n` +
      `Size: ${size}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm Pickup',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              
              console.log('Starting pickup process for item:', itemId);
              
              // First, verify the item is still pending
              const { data: itemData, error: fetchError } = await supabase
                .from('items')
                .select('status, user_id')
                .eq('id', itemId)
                .single();
              
              console.log('Item verification result:', { data: itemData, error: fetchError });

              if (fetchError) {
                console.error('Error fetching item for verification:', fetchError);
                throw fetchError;
              }
              
              if (!itemData) {
                console.error('Item not found for ID:', itemId);
                Alert.alert('Error', 'Item not found. Please try again.');
                return;
              }
              
              if (itemData.status !== 'pending') {
                console.log('Item already picked up, status:', itemData.status);
                Alert.alert('Error', 'This item is no longer available for pickup.');
                return;
              }

              // Calculate estimated delivery date (3 days from now)
              const estimatedDelivery = new Date();
              estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);
              
              console.log('Updating item status to accepted, user ID:', session.user.id);

              // Update item status to 'accepted'
              const updateResult = await supabase
                .from('items')
                .update({ 
                  status: 'accepted',
                  accepted_by: session.user.id,
                  pickup_date: new Date().toISOString(),
                  estimated_delivery_date: estimatedDelivery.toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', itemId)
                .eq('status', 'pending')
                .select();
              
              console.log('Update result:', updateResult);

              if (updateResult.error) {
                console.error('Error updating item status:', updateResult.error);
                throw updateResult.error;
              }
              
              if (updateResult.data && updateResult.data.length === 0) {
                console.warn('Item update produced no results, possible row not found');
              }

              // Create a pickup notification message
              console.log('Sending pickup notification to owner:', ownerId);
              const messageResult = await supabase
                .from('messages')
                .insert({
                  sender_id: session.user.id,
                  receiver_id: ownerId,
                  content: `I have picked up "${itemTitle}" and will deliver it to ${destination}.`,
                  item_id: itemId,
                  created_at: new Date().toISOString()
                })
                .select();
              
              console.log('Message result:', messageResult);

              if (messageResult.error) {
                console.error('Error sending pickup message:', messageResult.error);
                // Not throwing error here to continue with the process
              }
              
              // Fetch the updated item to verify the status change
              console.log('Verifying status change...');
              const verifyResult = await supabase
                .from('items')
                .select('status, accepted_by')
                .eq('id', itemId)
                .single();
                
              console.log('Verification result:', verifyResult);
              
              if (verifyResult.error) {
                console.warn('Error verifying item update:', verifyResult.error);
              } else if (verifyResult.data) {
                console.log('Verified item status is now:', verifyResult.data.status);
                setItemStatus(verifyResult.data.status);
              }
              
              // Update local state regardless of verification
              setItemStatus('accepted');
              
              // Show success message
              Alert.alert('Success', 'Item picked up successfully! It has been added to your carrying items.');
              
              // Switch to status tab
              setActiveTab('status');
              
            } catch (err: any) {
              console.error('Error confirming pickup:', err);
              Alert.alert('Error', `Failed to confirm pickup: ${err.message || 'Unknown error'}`);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleContactOwner = async () => {
    // Validate required data
    if (!itemId) {
      Alert.alert(
        'Error',
        'Item information is missing. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (!ownerId) {
      // Try to fetch owner information
      try {
        setLoading(true);
        // First get the item
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('user_id')
          .eq('id', itemId)
          .single();

        if (itemError) throw itemError;

        if (!itemData) {
          throw new Error('Item not found');
        }

        // Then get the user's name
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('name')
          .eq('id', itemData.user_id)
          .single();

        if (userError) throw userError;

        const ownerName = userData?.name || 'Item Owner';
        
        // Continue with chat creation using the fetched data
        await initializeChat(itemData.user_id, ownerName);
      } catch (error) {
        console.error('Error fetching owner information:', error);
        Alert.alert(
          'Error',
          'Unable to fetch item owner information. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    // If we have owner information, proceed with chat initialization
    await initializeChat(ownerId, ownerName);
  };

  const initializeChat = async (ownerId: string, ownerName: string) => {
    try {
      if (!session?.user?.id) {
        Alert.alert(
          'Authentication Required',
          'Please sign in to start a chat.',
          [
            {
              text: 'Sign In',
              onPress: () => {
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Auth' }],
                  })
                );
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Prevent starting chat with yourself
      if (session.user.id === ownerId) {
        Alert.alert(
          'Cannot Start Chat',
          'You cannot start a chat with yourself.',
          [{ text: 'OK' }]
        );
        return;
      }

      setLoading(true);

      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabase
        .from('messages')
        .select('id, created_at, content')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .or(`sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        console.error('Error checking existing chat:', chatError);
        throw chatError;
      }

      // If chat exists, navigate to it
      if (existingChat) {
        console.log('Existing chat found, navigating to chat...');
        navigation.navigate('Messages', {
          screen: 'Chat',
          params: {
            otherUserId: ownerId,
            otherUserName: ownerName,
            otherUserAvatar: null,
            itemId: itemId,
            tripId: null,
            chatId: existingChat.id,
            initialMessage: existingChat.content
          },
        });
        return;
      }

      console.log('Creating new chat...');
      // Create initial message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: session.user.id,
          receiver_id: ownerId,
          content: `Hi! I'm interested in your pickup for ${itemTitle}`,
          item_id: itemId,
          trip_id: null,
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error creating initial message:', messageError);
        throw messageError;
      }

      console.log('Message created successfully, navigating to chat...');
      // Navigate to chat
      navigation.navigate('Messages', {
        screen: 'Chat',
        params: {
          otherUserId: ownerId,
          otherUserName: ownerName,
          otherUserAvatar: null,
          itemId: itemId,
          tripId: null,
          chatId: message.id,
          initialMessage: message.content
        },
      });
    } catch (error) {
      console.error('Error in initializeChat:', error);
      Alert.alert(
        'Error',
        'Failed to start chat. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => initializeChat(ownerId, ownerName)
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setLoading(false)
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDelivered = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to mark items as delivered.');
      return;
    }

    Alert.alert(
      'Mark as Delivered',
      'Are you sure you have delivered this item?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Verify the item is still accepted
              const { data: itemData, error: fetchError } = await supabase
                .from('items')
                .select('status, accepted_by')
                .eq('id', itemId)
                .single();
              
              if (fetchError) throw fetchError;
              
              if (!itemData) {
                throw new Error('Item not found');
              }
              
              if (itemData.status !== 'accepted') {
                Alert.alert('Error', 'This item is not in an accepted state.');
                return;
              }
              
              if (itemData.accepted_by !== session.user.id) {
                Alert.alert('Error', 'You are not authorized to mark this item as delivered.');
                return;
              }

              // Update item status to delivered
              const { error: updateError } = await supabase
                .from('items')
                .update({ 
                  status: 'delivered',
                  updated_at: new Date().toISOString()
                })
                .eq('id', itemId)
                .eq('status', 'accepted')
                .eq('accepted_by', session.user.id);

              if (updateError) throw updateError;

              // Create a delivery notification message
              const { error: messageError } = await supabase
                .from('messages')
                .insert({
                  sender_id: session.user.id,
                  receiver_id: ownerId,
                  content: `I have delivered "${itemTitle}" to ${destination}.`,
                  item_id: itemId,
                  created_at: new Date().toISOString()
                });

              if (messageError) {
                console.error('Error sending delivery message:', messageError);
                // Continue even if message fails
              }

              setItemStatus('delivered');
              Alert.alert('Success', 'Item marked as delivered!');
              navigation.goBack();
            } catch (error) {
              console.error('Error marking item as delivered:', error);
              Alert.alert('Error', 'Failed to mark item as delivered. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleShareItem = async () => {
    try {
      // Generate a shareable URL
      const shareUrl = `https://adera.app/items/${itemId}`;
      
      const shareMessage = `Check out this item on Adera: ${itemTitle}
From: ${origin}
To: ${destination}
Size: ${size}

${shareUrl}`;

      await Share.share({
        message: shareMessage,
        url: shareUrl,
        title: `Adera Item: ${itemTitle}`,
      });
    } catch (error) {
      console.error('Error sharing item:', error);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'details':
        return (
          <>
            <Animated.View 
              entering={FadeInDown.duration(500).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Item Information</Text>
              <View style={styles.infoCard}>
                <Text style={styles.itemTitle}>{itemTitle}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="cube" size={20} color="#6C757D" />
                  <Text style={styles.infoText}>Size: {size}</Text>
                </View>
                
                {/* Status indicator */}
                <View style={styles.statusIndicator}>
                  <View style={[
                    styles.statusDot, 
                    itemStatus === 'pending' ? styles.pendingDot : 
                    itemStatus === 'accepted' ? styles.acceptedDot : 
                    styles.deliveredDot
                  ]} />
                  <Text style={styles.statusLabel}>
                    Status: {itemStatus.charAt(0).toUpperCase() + itemStatus.slice(1)}
                  </Text>
                </View>

                {/* Dates */}
                {itemStatus === 'accepted' && (
                  <View style={styles.datesContainer}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={20} color="#6C757D" />
                      <View style={styles.dateInfo}>
                        <Text style={styles.dateLabel}>Pickup Date</Text>
                        <Text style={styles.dateValue}>
                          {formatDate(pickupDate)}
                          {pickupDate && ` at ${formatTime(pickupDate)}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dateRow}>
                      <Ionicons name="time-outline" size={20} color="#6C757D" />
                      <View style={styles.dateInfo}>
                        <Text style={styles.dateLabel}>Estimated Delivery</Text>
                        <Text style={styles.dateValue}>
                          {formatDate(estimatedDeliveryDate)}
                          {estimatedDeliveryDate && ` by ${formatTime(estimatedDeliveryDate)}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              
              {/* Only show pickup button if item is pending */}
              {itemStatus === 'pending' && (
                <TouchableOpacity
                  style={styles.pickupButton}
                  onPress={handlePickupItem}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.pickupButtonText}>Pick Up This Item</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              
              {/* Show confirmation if already picked up */}
              {itemStatus === 'accepted' && (
                <View style={styles.acceptedContainer}>
                  <Ionicons name="checkmark-circle" size={30} color="#28A745" />
                  <Text style={styles.acceptedText}>You are carrying this item</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View 
              entering={FadeInDown.duration(500).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Route</Text>
              <View style={styles.routeCard}>
                <View style={styles.routePoint}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="location" size={16} color="#007AFF" />
                  </View>
                  <View style={styles.routeTextContainer}>
                    <Text style={styles.routeLabel}>Pickup Location</Text>
                    <Text style={styles.routeText}>{origin}</Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="location" size={16} color="#007AFF" />
                  </View>
                  <View style={styles.routeTextContainer}>
                    <Text style={styles.routeLabel}>Delivery Location</Text>
                    <Text style={styles.routeText}>{destination}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </>
        );
      case 'chat':
        return (
          <Animated.View 
            entering={FadeInDown.duration(500)}
            style={styles.chatSection}
          >
            <Text style={styles.sectionTitle}>Chat with Owner</Text>
            <View style={styles.chatInfoCard}>
              <View style={styles.chatUserInfo}>
                <View style={styles.chatUserAvatar}>
                  <Ionicons name="person" size={24} color={colors.primary} />
                </View>
                <View style={styles.chatUserDetails}>
                  <Text style={styles.chatUserName}>{ownerName}</Text>
                  <View style={styles.chatUserStatusContainer}>
                    <View style={styles.chatUserStatusDot} />
                    <Text style={styles.chatUserStatus}>{ownerName}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.chatItemInfo}>
                <Text style={styles.chatItemTitle}>{itemTitle}</Text>
                <View style={styles.chatItemMeta}>
                  <View style={styles.chatItemMetaItem}>
                    <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                    <Text style={styles.chatItemMetaText}>{origin} → {destination}</Text>
                  </View>
                  <View style={styles.chatItemMetaItem}>
                    <Ionicons name="cube-outline" size={16} color={colors.text.secondary} />
                    <Text style={styles.chatItemMetaText}>{size}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.chatButton, loading && styles.chatButtonDisabled]}
                onPress={handleContactOwner}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={24} color={colors.white} />
                    <Text style={styles.chatButtonText}>Start Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      case 'status':
        return (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Delivery Status</Text>
            <View style={styles.statusCard}>
              {/* Pickup Status */}
              <View style={styles.statusItem}>
                <View style={[
                  styles.statusIcon,
                  itemStatus === 'pending' ? styles.statusIconInactive :
                  itemStatus === 'accepted' || itemStatus === 'delivered' ? styles.statusIconActive :
                  styles.statusIconPending
                ]}>
                  <Ionicons name="cube" size={20} color="#fff" />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Item Pickup</Text>
                  <Text style={styles.statusSubtitle}>
                    {itemStatus === 'pending' ? 'Waiting to be picked up' :
                     itemStatus === 'accepted' ? `Picked up on ${formatDate(pickupDate)}` :
                     'Item has been picked up'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusLine} />

              {/* In Transit Status */}
              <View style={styles.statusItem}>
                <View style={[
                  styles.statusIcon,
                  itemStatus === 'pending' ? styles.statusIconInactive :
                  itemStatus === 'accepted' ? styles.statusIconActive :
                  itemStatus === 'delivered' ? styles.statusIconActive :
                  styles.statusIconPending
                ]}>
                  <Ionicons name="car" size={20} color="#fff" />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>In Transit</Text>
                  <Text style={styles.statusSubtitle}>
                    {itemStatus === 'pending' ? 'Not yet in transit' :
                     itemStatus === 'accepted' ? `Estimated delivery by ${formatDate(estimatedDeliveryDate)}` :
                     itemStatus === 'delivered' ? 'Delivery completed' :
                     'Item is being delivered'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusLine} />

              {/* Delivery Status */}
              <View style={styles.statusItem}>
                <View style={[
                  styles.statusIcon,
                  itemStatus === 'delivered' ? styles.statusIconActive :
                  styles.statusIconInactive
                ]}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </View>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>Delivery</Text>
                  <Text style={styles.statusSubtitle}>
                    {itemStatus === 'delivered' ? 'Item has been delivered' :
                     itemStatus === 'accepted' ? 'In progress' :
                     'Not yet delivered'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            {itemStatus === 'accepted' && (
              <TouchableOpacity
                style={styles.deliverButton}
                onPress={handleMarkAsDelivered}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Status Details */}
            {itemStatus === 'accepted' && (
              <View style={styles.statusDetailsCard}>
                <Text style={styles.statusDetailsTitle}>Delivery Details</Text>
                <View style={styles.statusDetailsRow}>
                  <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
                  <View style={styles.statusDetailsTextContainer}>
                    <Text style={styles.statusDetailsLabel}>Pickup Date</Text>
                    <Text style={styles.statusDetailsValue}>
                      {formatDate(pickupDate)}
                      {pickupDate && ` at ${formatTime(pickupDate)}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusDetailsRow}>
                  <Ionicons name="time-outline" size={20} color={colors.text.secondary} />
                  <View style={styles.statusDetailsTextContainer}>
                    <Text style={styles.statusDetailsLabel}>Estimated Delivery</Text>
                    <Text style={styles.statusDetailsValue}>
                      {formatDate(estimatedDeliveryDate)}
                      {estimatedDeliveryDate && ` by ${formatTime(estimatedDeliveryDate)}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusDetailsRow}>
                  <Ionicons name="location-outline" size={20} color={colors.text.secondary} />
                  <View style={styles.statusDetailsTextContainer}>
                    <Text style={styles.statusDetailsLabel}>Delivery Location</Text>
                    <Text style={styles.statusDetailsValue}>{destination}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.itemImage} />
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={handleShareItem}
            >
              <Ionicons name="share-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
            onPress={() => setActiveTab('details')}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={20} 
              color={activeTab === 'details' ? '#007AFF' : '#6C757D'} 
            />
            <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
              Details
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
            onPress={() => setActiveTab('chat')}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={20} 
              color={activeTab === 'chat' ? '#007AFF' : '#6C757D'} 
            />
            <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
              Chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'status' && styles.activeTab]}
            onPress={() => setActiveTab('status')}
          >
            <Ionicons 
              name="time-outline" 
              size={20} 
              color={activeTab === 'status' ? '#007AFF' : '#6C757D'} 
            />
            <Text style={[styles.tabText, activeTab === 'status' && styles.activeTabText]}>
              Status
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {renderTabContent()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  itemImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  shareButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: spacing.xs,
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#6C757D',
    marginLeft: spacing.sm,
  },
  routeCard: {
    backgroundColor: '#F8F9FA',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeTextContainer: {
    marginLeft: spacing.md,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 2,
  },
  routeText: {
    fontSize: 16,
    color: '#212529',
  },
  routeLine: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: spacing.sm,
    marginLeft: 16,
  },
  chatSection: {
    padding: spacing.lg,
  },
  chatInfoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  chatUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  chatUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.small,
  },
  chatUserDetails: {
    flex: 1,
  },
  chatUserName: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  chatUserStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatUserStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.xs,
  },
  chatUserStatus: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  chatItemInfo: {
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  chatItemTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  chatItemMeta: {
    gap: spacing.sm,
  },
  chatItemMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatItemMetaText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  chatButtonDisabled: {
    opacity: 0.7,
  },
  chatButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
  },
  statusSection: {
    padding: spacing.lg,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  statusIconActive: {
    backgroundColor: colors.success,
  },
  statusIconPending: {
    backgroundColor: colors.warning,
  },
  statusIconInactive: {
    backgroundColor: colors.text.secondary,
  },
  statusTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusLine: {
    height: 1,
    backgroundColor: colors.background,
    marginVertical: spacing.md,
    marginLeft: 20,
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    ...shadows.small,
  },
  deliverButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
  },
  statusDetailsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    ...shadows.medium,
  },
  statusDetailsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statusDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusDetailsTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statusDetailsLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  statusDetailsValue: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  pendingDot: {
    backgroundColor: '#FFA500', // Orange for pending
  },
  acceptedDot: {
    backgroundColor: '#28A745', // Green for accepted
  },
  deliveredDot: {
    backgroundColor: '#4169E1', // Blue for delivered
  },
  statusLabel: {
    fontSize: 14,
    color: '#6C757D',
  },
  pickupButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  pickupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  acceptedText: {
    fontSize: 16,
    color: '#28A745',
    fontWeight: '500',
    marginLeft: 8,
  },
  datesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dateInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  dateLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
}); 