import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CommonActions, CompositeNavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, TabParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';
import { MessageStatus, MessageType } from '../types/chat';
// Enhanced imports for QR and handover features
import HandoverCamera from '../components/HandoverCamera';
import { PackageQRDisplay } from '../components/PackageQRDisplay';
import { QRScanner } from '../components/QRScanner';
import { didService } from '../services/DIDService';
import { HandoverService, PackageDetails } from '../services/HandoverService';
import { GPSCoordinates, LocationService } from '../services/LocationService';

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

  // Enhanced state for QR code and handover verification
  const [showHandoverCamera, setShowHandoverCamera] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRDisplay, setShowQRDisplay] = useState(false);
  const [currentHandoverType, setCurrentHandoverType] = useState<'pickup' | 'delivery'>('pickup');
  const [didStatus, setDidStatus] = useState<'loading' | 'exists' | 'missing'>('loading');
  const [userDID, setUserDID] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [generatedQRData, setGeneratedQRData] = useState<string | null>(null);
  const [qrPackageDetails, setQRPackageDetails] = useState<any>(null);
  const [itemQRData, setItemQRData] = useState<string | null>(null);

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
  const lastStatusFetch = useRef<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      console.log('PickupDetailsScreen focused - fetching latest item status');
      
      // Only fetch if we don't have recent data (within last 30 seconds)
      const lastFetch = Date.now() - (lastStatusFetch.current || 0);
      if (lastFetch > 30000) { // 30 seconds throttle
        fetchItemStatus();
        lastStatusFetch.current = Date.now();
      }
      
      return () => {
        // cleanup if needed
      };
    }, []) // Remove itemId from dependencies to prevent excessive calls
  );

  // Initialize handover verification system
  useEffect(() => {
    initializeHandoverSystem();
  }, [session?.user?.id]);

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

  const initializeHandoverSystem = async () => {
    if (!session?.user?.id) return;
    
    // Check DID status
    try {
      setDidStatus('loading');
      
      // Get user profile from Supabase to check for DID
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('did_identifier, public_key')
        .eq('id', session.user.id)
        .single();
      
      if (!error && userProfile?.did_identifier) {
        setDidStatus('exists');
        setUserDID(userProfile.did_identifier);
        console.log('✅ DID found in profile:', userProfile.did_identifier);
      } else {
        // Check if user has DID key pair stored locally
        const hasKeyPair = await didService.hasDIDKeyPair(session.user.id);
        
        if (hasKeyPair) {
          const keyPair = await didService.retrieveDIDKeyPair(session.user.id);
          if (keyPair) {
            setDidStatus('exists');
            setUserDID(keyPair.did);
            console.log('✅ DID found in keychain:', keyPair.did);
          } else {
            setDidStatus('missing');
          }
        } else {
          setDidStatus('missing');
        }
      }
    } catch (error) {
      console.error('Error checking DID status:', error);
      setDidStatus('missing');
    }
    
    // Get current location
    try {
      const locationService = LocationService.getInstance();
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
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

    // Check if user has DID
    if (didStatus === 'missing') {
      Alert.alert(
        'Digital Identity Required',
        'You need to create your digital identity first for secure handover verification.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Identity',
            onPress: async () => {
              try {
                const result = await didService.createDIDForUser(session.user.id);
                if (result.success) {
                  Alert.alert('Success', 'Your digital identity has been created');
                  await initializeHandoverSystem();
                } else {
                  Alert.alert('Error', result.error || 'Failed to create digital identity');
                }
              } catch (error) {
                console.error('Error creating DID:', error);
                Alert.alert('Error', 'Failed to create digital identity');
              }
            }
          }
        ]
      );
      return;
    }

    // Start handover verification process
    Alert.alert(
      '🔐 Secure Pickup Verification',
      `Start secure handover verification for "${itemTitle}"?\n\nThis will:\n• Verify your GPS location\n• Take a pickup photo\n• Create blockchain signature\n• Update item status`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Verification',
          onPress: () => {
            setCurrentHandoverType('pickup');
            setShowHandoverCamera(true);
          }
        }
      ]
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

    // Check if item has QR code for verification
    try {
      const { data: itemData, error } = await supabase
        .from('items')
        .select('qr_code_data, qr_signature, status, accepted_by')
        .eq('id', itemId)
        .single();

      if (error) throw error;

      if (itemData?.qr_code_data) {
        // Item has QR code - require scanning for verification
        Alert.alert(
          '🔍 QR Code Verification Required',
          'This package has QR code verification enabled. Please scan the QR code to confirm delivery.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Scan QR Code',
              onPress: () => {
                setItemQRData(itemData.qr_code_data);
                setShowQRScanner(true);
              }
            }
          ]
        );
      } else {
        // Fallback to handover verification
        Alert.alert(
          '🔐 Secure Delivery Verification',
          'Start secure handover verification for delivery?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start Verification',
              onPress: () => {
                setCurrentHandoverType('delivery');
                setShowHandoverCamera(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking QR code:', error);
      // Fallback to basic delivery confirmation
      Alert.alert(
        'Mark as Delivered',
        'Are you sure you have delivered this item?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => completeItemDelivery() }
        ]
      );
    }
  };

  const handleQRScanResult = async (qrData: string) => {
    try {
      const handoverService = HandoverService.getInstance();
      
      // Validate QR code against expected package ID
      const expectedPackageId = `ITEM-${itemId}`;
      const validationResult = await handoverService.validateQRCode(qrData, expectedPackageId);

      if (validationResult.valid) {
        setShowQRScanner(false);
        
        Alert.alert(
          'QR Code Verified! 🎉',
          'Package authenticity confirmed. Proceeding with delivery verification.',
          [
            {
              text: 'Complete Delivery',
              onPress: () => {
                setCurrentHandoverType('delivery');
                setShowHandoverCamera(true);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'QR Code Invalid ❌',
          'This QR code does not match the expected package. Please verify you have the correct item.',
          [
            { text: 'Try Again', onPress: () => setShowQRScanner(false) },
            { text: 'Cancel', onPress: () => setShowQRScanner(false) }
          ]
        );
      }
    } catch (error) {
      console.error('QR validation error:', error);
      Alert.alert('Verification Error', 'Failed to validate QR code. Please try again.');
      setShowQRScanner(false);
    }
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

  const handleHandoverVerificationCapture = async (photoUri: string, location: GPSCoordinates) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'Missing user information');
      setShowHandoverCamera(false);
      return;
    }

    try {
      const handoverService = HandoverService.getInstance();

      // Create package details for verification
      const packageDetails: PackageDetails = {
        packageId: `ITEM-${itemId}`,
        senderDID: userDID || 'temp-sender-did',
        travelerDID: userDID || 'temp-traveler-did',
        destination: destination,
        value: 0, // Could be item value if available
        expectedLocation: {
          latitude: 37.7749, // This would normally come from item pickup location
          longitude: -122.4194,
          accuracy: 10
        }
      };

      if (currentHandoverType === 'pickup') {
        // Verify pickup
        const result = await handoverService.verifyPickup(packageDetails, session.user.id);

        if (result.success) {
          // Generate QR code for the package
          console.log('📦 Generating QR code for picked up package...');
          
          const qrResult = await handoverService.generateEnhancedPackageQR(
            packageDetails,
            session.user.id,
            session.user.email || 'Anonymous Traveler'
          );

          // Store QR data in database
          await supabase
            .from('items')
            .update({
              qr_code_data: qrResult.qrData,
              qr_signature: qrResult.signature,
              qr_generated_at: new Date().toISOString()
            })
            .eq('id', itemId);

          // Complete the pickup in database
          await completeItemPickup();
          
          // Prepare QR display data
          setGeneratedQRData(qrResult.qrData);
          setQRPackageDetails({
            title: itemTitle,
            destination: destination,
            size: size,
            travelerName: session.user.email || 'Anonymous Traveler'
          });
          
          Alert.alert(
            'Pickup Verified! 🎉',
            `Package pickup successfully verified!\n\nLocation Accuracy: ${result.distance}m\nVerification: ${result.verified ? 'Confirmed' : 'Manual Override'}\nQR code generated for delivery verification.`,
            [
              { 
                text: 'Continue', 
                onPress: () => {
                  // Show QR code for sender
                  setShowQRDisplay(true);
                }
              }
            ]
          );
        } else {
          Alert.alert(
            'Verification Failed',
            result.error || 'Unable to complete handover verification',
            [{ text: 'OK' }]
          );
        }
      } else if (currentHandoverType === 'delivery') {
        // Verify delivery
        const result = await handoverService.verifyDelivery(packageDetails, session.user.id);

        if (result.success) {
          await completeItemDelivery();
          
          Alert.alert(
            'Delivery Verified! 🎉',
            `Package delivery successfully verified!\n\nLocation Accuracy: ${result.distance}m\nVerification: ${result.verified ? 'Confirmed' : 'Manual Override'}`,
            [{ text: 'Excellent!' }]
          );
        } else {
          Alert.alert(
            'Verification Failed',
            result.error || 'Unable to complete delivery verification',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Handover verification error:', error);
      Alert.alert('Verification Failed', 'Unable to process handover verification. Please try again.');
    } finally {
      setShowHandoverCamera(false);
    }
  };

  const completeItemPickup = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'Please log in to pick up items');
      return;
    }

    try {
      console.log('Processing pickup for item:', itemId);
      
      // Get additional item data if needed
      const { data: itemData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError) {
        console.error('Error fetching item data:', itemError);
        throw itemError;
      }

      // Calculate estimated delivery date (2-7 days from now)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 5) + 2);

      console.log('Updating item status to accepted for user:', session.user.id);
      
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
        .eq('status', 'pending')  // Only update if status is still pending
        .select();

      console.log('Update result:', updateResult);
      
      if (updateResult.error) {
        console.error('Error updating item status:', updateResult.error);
        throw updateResult.error;
      }
      
      if (updateResult.data && updateResult.data.length === 0) {
        console.warn('Update returned no results, possible row not found or status already changed');
      }

      // Create a pickup notification message
      console.log('Sending pickup notification to sender:', ownerId);
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
        // Don't throw error here, just log it
      }

      // Update local state
      setItemStatus('accepted');
      setPickupDate(new Date());
      setEstimatedDeliveryDate(estimatedDelivery);
      
      // Switch to status tab
      setActiveTab('status');
    } catch (err: any) {
      console.error('Error confirming pickup:', err);
      Alert.alert('Error', `Failed to confirm pickup: ${err.message || 'Unknown error'}`);
    }
  };

  const completeItemDelivery = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to mark items as delivered.');
      return;
    }

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
      navigation.goBack();
    } catch (error) {
      console.error('Error marking item as delivered:', error);
      Alert.alert('Error', 'Failed to mark item as delivered. Please try again.');
    } finally {
      setLoading(false);
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
                <View style={styles.headerContainer}>
                  <Text style={styles.itemTitle}>{itemTitle}</Text>
                  {/* Security Badge */}
                  {didStatus === 'exists' && (
                    <View style={styles.securityBadge}>
                      <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.securityBadgeText}>Blockchain Verified</Text>
                    </View>
                  )}
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="cube" size={20} color="#6C757D" />
                  <Text style={styles.infoText}>Size: {size}</Text>
                </View>

                {/* Owner Information */}
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={20} color="#6C757D" />
                  <Text style={styles.infoText}>Owner: {ownerName}</Text>
                </View>

                {/* DID Status Indicator */}
                {didStatus !== 'loading' && (
                  <View style={styles.didStatusContainer}>
                    <View style={styles.infoRow}>
                      <Ionicons 
                        name={didStatus === 'exists' ? "checkmark-circle" : "alert-circle"} 
                        size={20} 
                        color={didStatus === 'exists' ? "#28A745" : "#FFA500"} 
                      />
                      <Text style={[
                        styles.infoText,
                        { color: didStatus === 'exists' ? "#28A745" : "#FFA500" }
                      ]}>
                        {didStatus === 'exists' ? 'Digital Identity Verified' : 'Digital Identity Required'}
                      </Text>
                    </View>
                    {userDID && (
                      <Text style={styles.didText}>DID: {userDID}</Text>
                    )}
                  </View>
                )}
                
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

                {/* Enhanced Dates with Icons */}
                {itemStatus === 'accepted' && (
                  <View style={styles.datesContainer}>
                    <View style={styles.dateRow}>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                      <View style={styles.dateInfo}>
                        <Text style={styles.dateLabel}>Pickup Date</Text>
                        <Text style={styles.dateValue}>
                          {formatDate(pickupDate)}
                          {pickupDate && ` at ${formatTime(pickupDate)}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dateRow}>
                      <Ionicons name="time-outline" size={20} color="#FF6B35" />
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
              
              {/* Enhanced Action Buttons */}
              {itemStatus === 'pending' && (
                <TouchableOpacity
                  style={[
                    styles.pickupButton,
                    didStatus === 'missing' ? styles.disabledButton : styles.enabledButton
                  ]}
                  onPress={handlePickupItem}
                  disabled={loading || didStatus === 'loading'}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons 
                        name={didStatus === 'exists' ? "shield-checkmark" : "checkmark-circle"} 
                        size={20} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.pickupButtonText}>
                        {didStatus === 'exists' ? 'Secure Pickup Verification' : 'Pick Up This Item'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              
              {/* Enhanced Accepted Status */}
              {itemStatus === 'accepted' && (
                <View style={styles.acceptedContainer}>
                  <View style={styles.acceptedHeader}>
                    <Ionicons name="checkmark-circle" size={30} color="#28A745" />
                    <View style={styles.acceptedTextContainer}>
                      <Text style={styles.acceptedText}>You are carrying this item</Text>
                      <Text style={styles.acceptedSubtext}>Ready for secure delivery</Text>
                    </View>
                  </View>
                  
                  {/* QR Code Actions */}
                  <View style={styles.qrActionsContainer}>
                    <TouchableOpacity
                      style={styles.qrActionButton}
                      onPress={() => {
                        if (generatedQRData && qrPackageDetails) {
                          setShowQRDisplay(true);
                        } else {
                          Alert.alert('QR Code', 'QR code will be generated during pickup verification');
                        }
                      }}
                    >
                      <Ionicons name="qr-code" size={20} color="#007AFF" />
                      <Text style={styles.qrActionText}>View QR Code</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.qrActionButton}
                      onPress={handleShareItem}
                    >
                      <Ionicons name="share-outline" size={20} color="#007AFF" />
                      <Text style={styles.qrActionText}>Share Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Animated.View>

            <Animated.View 
              entering={FadeInDown.duration(500).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Route & Security</Text>
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

                {/* Security Features */}
                <View style={styles.securityFeaturesContainer}>
                  <Text style={styles.securityFeaturesTitle}>Security Features</Text>
                  <View style={styles.securityFeaturesList}>
                    <View style={styles.securityFeature}>
                      <Ionicons name="camera" size={16} color="#28A745" />
                      <Text style={styles.securityFeatureText}>Photo Verification</Text>
                    </View>
                    <View style={styles.securityFeature}>
                      <Ionicons name="location" size={16} color="#28A745" />
                      <Text style={styles.securityFeatureText}>GPS Tracking</Text>
                    </View>
                    <View style={styles.securityFeature}>
                      <Ionicons name="qr-code" size={16} color="#28A745" />
                      <Text style={styles.securityFeatureText}>QR Code Auth</Text>
                    </View>
                    <View style={styles.securityFeature}>
                      <Ionicons name="shield-checkmark" size={16} color="#28A745" />
                      <Text style={styles.securityFeatureText}>Blockchain Signature</Text>
                    </View>
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
              <View style={styles.deliveryActionsContainer}>
                <TouchableOpacity
                  style={styles.deliverButton}
                  onPress={handleMarkAsDelivered}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="qr-code-outline" size={24} color="#fff" />
                      <Text style={styles.deliverButtonText}>Verify & Deliver</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                {/* Manual Delivery Option */}
                <TouchableOpacity
                  style={styles.manualDeliveryButton}
                  onPress={() => {
                    Alert.alert(
                      'Manual Delivery',
                      'Are you sure you want to mark this item as delivered without QR verification?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm', onPress: () => completeItemDelivery() }
                      ]
                    );
                  }}
                  disabled={loading}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#6C757D" />
                  <Text style={styles.manualDeliveryText}>Manual Delivery</Text>
                </TouchableOpacity>
              </View>
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

      {/* Handover Verification Camera */}
      {showHandoverCamera && currentLocation && (
        <HandoverCamera
          expectedLocation={currentLocation}
          onCapture={handleHandoverVerificationCapture}
          onCancel={() => {
            setShowHandoverCamera(false);
          }}
          type={currentHandoverType}
          packageTitle={itemTitle}
        />
      )}

      {/* QR Code Scanner */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScanResult}
          onCancel={() => setShowQRScanner(false)}
          title="Verify Package QR"
          subtitle="Scan the QR code provided by the sender"
        />
      )}

      {/* Package QR Code Display */}
      {showQRDisplay && generatedQRData && qrPackageDetails && (
        <PackageQRDisplay
          visible={showQRDisplay}
          onClose={() => setShowQRDisplay(false)}
          qrData={generatedQRData}
          packageDetails={qrPackageDetails}
        />
      )}
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  securityBadge: {
    backgroundColor: '#28A745',
    borderRadius: 4,
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  securityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
  didStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  didText: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: spacing.sm,
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
  acceptedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  acceptedTextContainer: {
    marginLeft: spacing.sm,
  },
  acceptedText: {
    fontSize: 16,
    color: '#28A745',
    fontWeight: '500',
  },
  acceptedSubtext: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  qrActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  qrActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  qrActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  deliveryActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  deliverButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
  },
  manualDeliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    ...shadows.small,
  },
  manualDeliveryText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
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
  securityFeaturesContainer: {
    marginTop: spacing.lg,
  },
  securityFeaturesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  securityFeaturesList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  securityFeatureText: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  enabledButton: {
    backgroundColor: '#007AFF',
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