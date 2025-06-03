import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import HandoverCamera from '../components/HandoverCamera';
import { QRScanner } from '../components/QRScanner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { didService } from '../services/DIDService';
import { HandoverService, PackageDetails } from '../services/HandoverService';
import { GPSCoordinates, LocationService } from '../services/LocationService';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';

const { width } = Dimensions.get('window');

type RouteParams = {
  itemId: string;
};

type NavigationProp = NativeStackNavigationProp<any>;

interface Item {
  id: string;
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  size: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'delivered';
  created_at: string;
  image_url?: string;
  user_id: number;
  accepted_by?: number;
  pickup_date?: string;
  estimated_delivery_date?: string;
  owner: {
    id: number;
    name: string;
    avatar_url?: string;
  };
}

export default function TravelerItemDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { itemId } = route.params as RouteParams;
  const { session } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Handover verification states
  const [showHandoverCamera, setShowHandoverCamera] = useState(false);
  const [didStatus, setDidStatus] = useState<'loading' | 'exists' | 'missing'>('loading');
  const [userDID, setUserDID] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);

  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrVerified, setQRVerified] = useState(false);
  const [scannedQRData, setScannedQRData] = useState<any>(null);

  useEffect(() => {
    fetchItemDetails();
  }, [itemId]);

  // Initialize handover verification system
  useEffect(() => {
    initializeHandoverSystem();
  }, [session?.user?.id]);

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
      const location = await LocationService.getInstance().getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          owner:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .eq('id', itemId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setItem(data);
      }
    } catch (error: any) {
      console.error('Error fetching item details:', error.message);
      Alert.alert('Error', 'Failed to load item details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDelivered = () => {
    if (!item) return;

    if (!session?.user?.id) {
      Alert.alert('Error', 'Please log in to mark items as delivered');
      return;
    }

    // Check if user has DID
    if (didStatus === 'missing') {
      Alert.alert(
        'Digital Identity Required',
        'You need to create your digital identity first for secure delivery verification.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Identity',
            onPress: async () => {
              try {
                const result = await didService.createDIDForUser(session.user.id);
                if (result.success) {
                  Alert.alert('Success', 'Your digital identity has been created');
                  setDidStatus('exists');
                  setUserDID(result.did || null);
                } else {
                  Alert.alert('Error', result.error || 'Failed to create digital identity');
                }
              } catch (error) {
                Alert.alert('Error', 'Unable to create digital identity');
              }
            }
          }
        ]
      );
      return;
    }

    // Step 1: Scan QR code first
    if (!qrVerified) {
      Alert.alert(
        'QR Code Required',
        'Please scan the sender\'s QR code to verify package authenticity before delivery.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Scan QR Code',
            onPress: () => setShowQRScanner(true)
          }
        ]
      );
      return;
    }

    // Step 2: Proceed with handover verification after QR is verified
    Alert.alert(
      'Start Delivery Verification',
      'Ready to complete secure delivery verification with photo and GPS.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Verification',
          onPress: () => setShowHandoverCamera(true)
        }
      ]
    );
  };

  const handleQRScan = async (qrData: string) => {
    if (!item) return;

    try {
      const handoverService = HandoverService.getInstance();
      
      // Validate QR code against expected package
      const validation = await handoverService.validateQRCode(qrData, `ITEM-${item.id}`);
      
      if (validation.valid) {
        setScannedQRData(validation.packageData);
        setQRVerified(true);
        setShowQRScanner(false);
        
        Alert.alert(
          '✅ QR Code Verified!',
          `Package authenticated successfully!\n\nPackage: ${validation.packageData?.title || item.title}\nDestination: ${validation.packageData?.destination || item.destination}\n\nYou can now proceed with delivery verification.`,
          [
            {
              text: 'Continue',
              onPress: () => {
                // Automatically start handover verification
                setShowHandoverCamera(true);
              }
            }
          ]
        );
      } else {
        Alert.alert(
          '❌ Invalid QR Code',
          validation.error || 'The scanned QR code does not match this package.',
          [
            {
              text: 'Try Again',
              onPress: () => setShowQRScanner(true)
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('QR validation error:', error);
      Alert.alert(
        'Verification Error',
        'Unable to validate QR code. Please try again.',
        [
          {
            text: 'Try Again',
            onPress: () => setShowQRScanner(true)
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handleDeliveryVerificationCapture = async (photoUri: string, location: GPSCoordinates) => {
    if (!item || !session?.user?.id) {
      Alert.alert('Error', 'Missing item or user information');
      setShowHandoverCamera(false);
      return;
    }

    try {
      const handoverService = HandoverService.getInstance();

      // Create package details for verification
      const packageDetails: PackageDetails = {
        packageId: `ITEM-${item.id}`,
        senderDID: userDID || 'temp-sender-did',
        travelerDID: userDID || 'temp-traveler-did',
        destination: item.destination,
        value: 0, // Could be item value if available
        expectedLocation: {
          latitude: 37.7749, // This would normally come from item destination location
          longitude: -122.4194,
          accuracy: 10
        }
      };

      // Verify delivery
      const result = await handoverService.verifyDelivery(packageDetails, session.user.id);

      if (result.success) {
        // Complete the delivery in database
        await completeDelivery();
        
        Alert.alert(
          'Delivery Verified! 🎉',
          `Package delivery successfully verified!\n\nLocation Accuracy: ${result.distance}m\nVerification: ${result.verified ? 'Confirmed' : 'Manual Override'}\nPayment released automatically! 💰`,
          [{ text: 'Continue', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Verification Failed',
          result.error || 'Unable to complete delivery verification',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Delivery verification error:', error);
      Alert.alert('Verification Failed', 'Unable to process delivery verification. Please try again.');
    } finally {
      setShowHandoverCamera(false);
    }
  };

  const completeDelivery = async () => {
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('items')
        .update({ 
          status: 'delivered',
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Send delivery notification to owner
      await supabase
        .from('messages')
        .insert({
          sender_id: session?.user?.id,
          receiver_id: item.owner.id,
          content: `I have delivered "${item.title}" to ${item.destination}.`,
          item_id: itemId,
          created_at: new Date().toISOString()
        });
      
      // Update local state to reflect the change
      setItem((prev: any) => ({
        ...prev,
        status: 'delivered',
        updated_at: new Date().toISOString()
      }));
      
      const successMessage = 'Item marked as delivered! 🎉';
      
      Alert.alert(
        'Success', 
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to dashboard
              navigation.navigate('Dashboard');
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error marking item as delivered:', error.message);
      Alert.alert('Error', `Failed to mark as delivered: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleContactOwner = async () => {
    if (!item?.owner?.id) {
      Alert.alert('Error', 'Unable to start chat. Please try again later.');
      return;
    }

    try {
      if (!session?.user?.id) {
        Alert.alert('Error', 'You must be logged in to start a chat');
        return;
      }

      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabase
        .from('messages')
        .select('id')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .or(`sender_id.eq.${item.owner.id},receiver_id.eq.${item.owner.id}`)
        .eq('item_id', itemId)
        .limit(1)
        .single();

      if (chatError && chatError.code !== 'PGRST116') {
        throw chatError;
      }

      // Navigate to chat
      navigation.navigate('Messages', {
        screen: 'Chat',
        params: {
          otherUserId: item.owner.id,
          otherUserName: item.owner.name,
          otherUserAvatar: item.owner.avatar_url,
          itemId: itemId,
          tripId: null,
        },
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this item I'm delivering: ${item?.title}`,
        title: item?.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#FFA500', icon: 'time-outline', label: 'Pending' };
      case 'accepted':
        return { color: '#32CD32', icon: 'checkmark-circle-outline', label: 'In Transit' };
      case 'delivered':
        return { color: '#4169E1', icon: 'checkmark-done-circle-outline', label: 'Delivered' };
      default:
        return { color: '#000', icon: 'alert-circle-outline', label: 'Unknown' };
    }
  };

  const statusConfig = getStatusConfig(item.status);
  const pickupDate = item.pickup_date ? new Date(item.pickup_date) : null;
  const estimatedDelivery = item.estimated_delivery_date ? new Date(item.estimated_delivery_date) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {item?.image_url && (
          <Animated.View 
            entering={FadeInDown.duration(500)}
            style={styles.imageContainer}
          >
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.itemImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.imageGradient}
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Animated.View 
          entering={FadeInUp.duration(500).delay(200)}
          style={styles.section}
        >
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="cube" size={24} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Package Size</Text>
                <Text style={styles.infoValue}>
                  {item.size.charAt(0).toUpperCase() + item.size.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar" size={24} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Pickup Date</Text>
                <Text style={styles.infoValue}>
                  {item.pickup_date ? formatDistanceToNow(new Date(item.pickup_date), { addSuffix: true }) : 'Not set'}
                </Text>
              </View>
            </View>

            {item.estimated_delivery_date && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconContainer}>
                    <Ionicons name="time" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Estimated Delivery</Text>
                    <Text style={styles.infoValue}>
                      {formatDistanceToNow(new Date(item.estimated_delivery_date), { addSuffix: true })}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.duration(500).delay(300)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Delivery Route</Text>
          <View style={styles.routeCard}>
            <View style={styles.routePoint}>
              <View style={[styles.routeIcon, styles.routeIconActive]}>
                <Ionicons name="location" size={20} color={colors.white} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>Pickup Location</Text>
                <Text style={styles.routeText}>{item.pickup_location}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={[styles.routeIcon, styles.routeIconPending]}>
                <Ionicons name="location" size={20} color={colors.white} />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>Delivery Location</Text>
                <Text style={styles.routeText}>{item.destination}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.duration(500).delay(400)}
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Item Owner</Text>
          <View style={styles.ownerCard}>
            <View style={styles.ownerInfo}>
              {item.owner?.avatar_url ? (
              <Image
                  source={{ uri: item.owner.avatar_url }}
                style={styles.ownerAvatar}
                  onError={() => {
                    console.log('Failed to load owner avatar:', item.owner?.avatar_url);
                  }}
              />
              ) : (
                <View style={[styles.ownerAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={16} color={colors.text.secondary} />
                </View>
              )}
              <View style={styles.ownerDetails}>
                <Text style={styles.ownerName}>{item.owner?.name || 'Unknown'}</Text>
                <Text style={styles.ownerRole}>Item Owner</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleContactOwner}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
              <Text style={styles.contactButtonText}>Contact Owner</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {item.status === 'accepted' && (
          <Animated.View 
            entering={FadeInUp.duration(500).delay(500)}
            style={styles.section}
          >
            <TouchableOpacity
              style={[styles.deliverButton, updating && styles.deliverButtonDisabled]}
              onPress={handleMarkAsDelivered}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color={colors.white} />
                  <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {/* QR Code Scanner */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onCancel={() => setShowQRScanner(false)}
          title="Scan Package QR"
          subtitle="Scan the sender's QR code to verify package"
        />
      )}
      
      {/* Handover Verification Camera */}
      {showHandoverCamera && item && currentLocation && (
        <HandoverCamera
          expectedLocation={currentLocation} // Use current location as expected for now
          onCapture={handleDeliveryVerificationCapture}
          onCancel={() => {
            setShowHandoverCamera(false);
          }}
          type="delivery"
          packageTitle={item.title}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: 300,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  itemTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.white,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  routeCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  routeIconActive: {
    backgroundColor: colors.success,
  },
  routeIconPending: {
    backgroundColor: colors.primary,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  routeText: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  routeLine: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    marginLeft: 20,
  },
  ownerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ownerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary + '20',
  },
  ownerDetails: {
    flex: 1,
  },
  ownerName: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  ownerRole: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  contactButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
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
  deliverButtonDisabled: {
    opacity: 0.7,
  },
  deliverButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.white,
    marginLeft: spacing.sm,
  },
  bottomSpacing: {
    height: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.error,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 