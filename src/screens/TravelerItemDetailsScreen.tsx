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
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

type RouteParams = {
  itemId: string;
};

type NavigationProp = NativeStackNavigationProp<any>;

export default function TravelerItemDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { itemId } = route.params as RouteParams;
  const { session } = useAuth();
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchItemDetails();
  }, [itemId]);

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
              
              Alert.alert(
                'Success', 
                'Item marked as delivered!',
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
              console.error('Error marking item as delivered:', error);
              Alert.alert('Error', 'Failed to mark item as delivered. Please try again.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
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
              <Image
                source={{ uri: item.owner?.avatar_url || 'https://via.placeholder.com/40' }}
                style={styles.ownerAvatar}
              />
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
}); 