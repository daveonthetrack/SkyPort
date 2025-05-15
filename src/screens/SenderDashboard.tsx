import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CompositeNavigationProp, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeInDown,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  Layout,
  withSequence,
  withDelay,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, TabParamList, MessagesStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { formatDistanceToNow, format } from 'date-fns';
import { RealtimeChannel } from '@supabase/supabase-js';

type SenderDashboardNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
  BottomTabNavigationProp<TabParamList>
>;

type Props = {
  navigation: SenderDashboardNavigationProp;
  route: RouteProp<HomeStackParamList, 'Dashboard'>;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.md * 3) / 2;

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type StatCardProps = {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  details?: string;
};

type ActivityItem = {
  id: string;
  type: 'item_posted' | 'item_accepted' | 'delivery_completed' | 'message_received';
  title: string;
  description: string;
  timestamp: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const QuickActionButton = ({ icon, label, onPress }: QuickActionProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease)
    });
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 400
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 400
    });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400
    });
  };

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Animated.View 
        style={[styles.quickActionButton, animatedStyle]}
        layout={Layout.duration(300)}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickActionGradient}
        >
          <Ionicons name={icon} size={24} color={colors.white} />
        </LinearGradient>
        <Animated.Text 
          style={styles.quickActionLabel}
          entering={FadeInUp.delay(200).springify()}
          layout={Layout.duration(300)}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const AnimatedTextWrapper = ({ children, style, entering, layout }: {
  children: React.ReactNode;
  style?: any;
  entering?: any;
  layout?: any;
}) => {
  return (
    <Animated.View
      entering={entering}
      layout={layout}
    >
      <Text style={style}>{children}</Text>
    </Animated.View>
  );
};

const AnimatedText = Animated.createAnimatedComponent(Text);

const StatCard = ({ title, value, icon, onPress, details }: StatCardProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease)
    });
  }, []);

  const onPressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 400
    });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400
    });
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (details) {
      Alert.alert(title, details);
    }
  };

  return (
    <TouchableOpacity 
      onPressIn={onPressIn} 
      onPressOut={onPressOut}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Animated.View 
        style={[styles.statCard, animatedStyle]}
        layout={Layout.duration(300)}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {details && (
          <Text style={styles.tapHint}>Tap for details</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const ActivityListItem = ({ item }: { item: ActivityItem }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.ease)
    });
    translateY.value = withSpring(0, {
      damping: 15,
      stiffness: 400
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Animated.View 
      style={[styles.activityItem, animatedStyle]}
      layout={Layout.duration(300)}
    >
      <View style={styles.activityIconContainer}>
        <Ionicons name={item.icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>
          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
        </Text>
      </View>
    </Animated.View>
  );
};

const SenderDashboard = ({ navigation, route }: Props) => {
  const { session, signOut, profile } = useAuth();
  const [stats, setStats] = useState({
    postedItems: 0,
    activeDeliveries: 0,
    completedDeliveries: 0,
    totalSpent: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);
  const [recentItems, setRecentItems] = useState(0);
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    
    // Initial data load
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchDashboardStats(),
          fetchRecentActivity(),
          fetchTrips()
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error loading initial dashboard data:', error);
      }
    };
    
    loadInitialData();
    
    // Set up realtime subscriptions after initial load
    const setupRealtimeSubscriptions = () => {
      console.log('Setting up realtime subscriptions for sender dashboard...');
      
      // Subscribe to items table changes
      const itemsChannel = supabase
        .channel('sender-dashboard-items')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${session.user.id}`
        }, () => {
          console.log('Items table changed, refreshing sender stats...');
          fetchDashboardStats();
          fetchRecentActivity();
        })
        .subscribe((status) => {
          console.log('Sender items subscription status:', status);
        });
      
      // Subscribe to messages table changes for updates to activity
      const messagesChannel = supabase
        .channel('sender-dashboard-messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${session.user.id}`
        }, () => {
          console.log('New messages received, refreshing activity...');
          fetchRecentActivity();
        })
        .subscribe();
      
      // Return cleanup function
      return () => {
        console.log('Cleaning up sender realtime subscriptions...');
        supabase.removeChannel(itemsChannel);
        supabase.removeChannel(messagesChannel);
      };
    };
    
    // Only set up realtime after initial data load to avoid race conditions
    let cleanup: (() => void) | undefined;
    if (initialLoadComplete) {
      cleanup = setupRealtimeSubscriptions();
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [session?.user?.id, initialLoadComplete]);

  const fetchDashboardStats = async () => {
    if (!session?.user?.id) return;

    try {
      console.log('Fetching sender dashboard stats...');
      
      // Fetch all items with their status
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, status, created_at')
        .eq('user_id', session.user.id);
        
      if (itemsError) throw itemsError;

      // Calculate different metrics
      const totalItems = items?.length || 0;
      
      const activeDeliveries = items?.filter(
        item => item.status === 'accepted'
      ).length || 0;
      
      const completedDeliveries = items?.filter(
        item => item.status === 'delivered'
      ).length || 0;
      
      // Calculate pending items
      const pendingItems = items?.filter(
        item => item.status === 'pending'
      ).length || 0;
      setPendingItems(pendingItems);
      
      // Count items posted in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentItems = items?.filter(
        item => new Date(item.created_at) > thirtyDaysAgo
      ).length || 0;
      setRecentItems(recentItems);
      
      // Create a more realistic total spent calculation
      // Assuming different sizes have different costs
      let totalSpent = 0;
      if (items && items.length > 0) {
        // For this example, we'll just calculate $50 per completed delivery
        // In a real app, you'd calculate based on item size, distance, etc.
        totalSpent = completedDeliveries * 50;
      }

      const newStats = {
        postedItems: totalItems,
        activeDeliveries,
        completedDeliveries,
        totalSpent,
      };
      
      console.log('Sender dashboard stats updated:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching sender dashboard stats:', error);
      Alert.alert('Error', 'Failed to load dashboard statistics');
    }
  };

  const fetchRecentActivity = async () => {
    if (!session?.user?.id) return;

    try {
      console.log('Fetching sender recent activity...');
      
      // Fetch recent items with profiles of travelers who accepted them
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          *,
          traveler:profiles!accepted_by(
            id,
            name,
            avatar_url
          )
        `)
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching activity items:', error);
        return;
      }
      
      console.log(`Fetched ${items?.length || 0} activity items`);

      const activity: ActivityItem[] = items?.map(item => ({
        id: `item-${item.id}`,
        type: item.status === 'delivered' ? 'delivery_completed' as const : 
              item.accepted_by ? 'item_accepted' as const : 
              'item_posted' as const,
        title: item.status === 'delivered' ? 'Delivery Completed' :
               item.accepted_by ? 'Item Accepted by Traveler' :
               'New Item Posted',
        description: `${item.title} (${item.origin} → ${item.destination})`,
        timestamp: item.updated_at || item.created_at,
        icon: item.status === 'delivered' ? 'checkmark-circle-outline' as const :
              item.accepted_by ? 'person-outline' as const :
              'cube-outline' as const
      })) || [];

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const fetchTrips = async () => {
    if (!session?.user?.id) return;

    try {
      console.log('Fetching sender trips...');
      
      // Fetch trips with traveler profiles
      const { data: trips, error } = await supabase
        .from('trips')
        .select(`
          *,
          user:profiles!user_id(
            id,
            name,
            avatar_url
          )
        `)
        .eq('user_id', session.user.id)
        .order('departure_date', { ascending: true });

      if (error) {
        console.error('Error fetching trips:', error);
        return;
      }
      
      // Ensure all dates are valid before setting state
      const validTrips = trips?.map(trip => ({
        ...trip,
        departure_date: trip.departure_date ? new Date(trip.departure_date).toISOString() : new Date().toISOString()
      })) || [];

      console.log(`Fetched ${validTrips.length} trips`);
      setTrips(validTrips);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchRecentActivity(),
        fetchTrips()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderTravelerCard = (trip: Trip) => (
    <TouchableOpacity
      style={styles.travelerCard}
      onPress={() => navigation.navigate('TripDetails', { tripId: trip.id.toString() })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          {trip.user?.avatar_url ? (
            <Image
              source={{ uri: trip.user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color={colors.text.secondary} />
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{trip.user?.name || 'Unknown'}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.rating}>{trip.user?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.deliveryCount}>
              ({trip.user?.delivery_count || 0} deliveries)
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.locations}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.location}>{trip.origin}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.text.secondary} />
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.location}>{trip.destination}</Text>
          </View>
        </View>
      </View>

      <View style={styles.metaInfo}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar" size={16} color={colors.text.secondary} />
          <Text style={styles.metaText}>
            {format(new Date(trip.departure_date), 'MMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="time" size={16} color={colors.text.secondary} />
          <Text style={styles.metaText}>
            {formatDistanceToNow(new Date(trip.departure_date), { addSuffix: true })}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons 
            name={trip.capacity === 'small' ? 'cube-outline' : 
                  trip.capacity === 'medium' ? 'cube' : 'cube-sharp'} 
            size={16} 
            color={colors.text.secondary} 
          />
          <Text style={styles.metaText}>
            {trip.capacity.charAt(0).toUpperCase() + trip.capacity.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => navigation.navigate('Chat', { 
            userId: trip.user_id.toString(),
            userName: trip.user?.name || 'Unknown'
          })}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.white} />
          <Text style={styles.contactButtonText}>Contact</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => navigation.navigate('TripDetails', { tripId: trip.id.toString() })}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <AnimatedTextWrapper 
              entering={FadeInUp.delay(200).springify()}
              layout={Layout.duration(300)}
              style={styles.welcomeText}
            >
              Welcome back,
            </AnimatedTextWrapper>
            <AnimatedTextWrapper 
              entering={FadeInUp.delay(400).springify()}
              layout={Layout.duration(300)}
              style={styles.userName}
            >
              {profile?.name || session?.user?.email?.split('@')[0]}
            </AnimatedTextWrapper>
          </View>
          <Animated.View
            entering={FadeInUp.delay(600).springify()}
            layout={Layout.duration(300)}
          >
            <TouchableOpacity
              onPress={async () => {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Sign Out',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          setIsSigningOut(true);
                          await signOut();
                        } catch (error) {
                          console.error('Error signing out:', error);
                          Alert.alert(
                            'Error',
                            'Failed to sign out. Please check your internet connection and try again.'
                          );
                        } finally {
                          setIsSigningOut(false);
                        }
                      },
                    },
                  ]
                );
              }}
              style={styles.signOutButton}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="log-out-outline" size={24} color={colors.white} />
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>

      <Animated.View 
        style={styles.content}
        entering={FadeInUp.delay(800).springify()}
        layout={Layout.duration(300)}
      >
        <AnimatedTextWrapper 
          entering={FadeInUp.delay(600).springify()}
          layout={Layout.duration(300)}
          style={styles.sectionTitle}
        >
          Quick Actions
        </AnimatedTextWrapper>
        <View style={styles.quickActionsContainer}>
          <QuickActionButton
            icon="cube-outline"
            label="Post Item"
            onPress={() => navigation.navigate('PostItem', undefined)}
          />
          <QuickActionButton
            icon="list-outline"
            label="My Items"
            onPress={() => navigation.navigate('MyItems', undefined)}
          />
          <QuickActionButton
            icon="airplane-outline"
            label="Find Travelers"
            onPress={() => navigation.navigate('FindTravelers', {})}
          />
          <QuickActionButton
            icon="chatbubbles-outline"
            label="Messages"
            onPress={() => navigation.navigate('Messages', { screen: 'ChatList' })}
          />
        </View>

        <View style={styles.feedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Travelers</Text>
            <TouchableOpacity onPress={() => navigation.navigate('FindTravelers')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.feedContainer}>
            {trips.map((trip) => (
              <Animated.View
                key={trip.id}
                entering={FadeInUp.delay(200).springify()}
              >
                {renderTravelerCard(trip)}
              </Animated.View>
            ))}
          </View>
        </View>

        <AnimatedTextWrapper 
          entering={FadeInUp.delay(800).springify()}
          layout={Layout.duration(300)}
          style={styles.sectionTitle}
        >
          Your Statistics
        </AnimatedTextWrapper>
        <View style={styles.statsContainer}>
          <StatCard
            title="Active Items"
            value={stats.activeDeliveries}
            icon="cube"
            details={`You currently have ${stats.activeDeliveries} items in transit with travelers.
            
These items are being carried by travelers to their destinations and are expected to be delivered soon.`}
          />
          <StatCard
            title="Total Spent"
            value={`$${stats.totalSpent}`}
            icon="wallet"
            details={`You have spent a total of $${stats.totalSpent} on ${stats.completedDeliveries} completed deliveries.

Average cost per delivery: $${stats.completedDeliveries > 0 ? (stats.totalSpent / stats.completedDeliveries).toFixed(2) : 0}`}
          />
        </View>

        <View style={styles.recentActivityContainer}>
          <View style={styles.sectionHeader}>
            <AnimatedTextWrapper 
              entering={FadeInUp.delay(1000).springify()}
              layout={Layout.duration(300)}
              style={styles.sectionTitle}
            >
              Recent Activity
            </AnimatedTextWrapper>
            <Animated.View
              entering={FadeInUp.delay(1000).springify()}
              layout={Layout.duration(300)}
            >
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          {recentActivity.map((item, index) => (
            <ActivityListItem 
              key={item.id} 
              item={item}
            />
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: typography.sizes.lg,
    color: colors.white,
    opacity: 0.9,
  },
  userName: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    color: colors.white,
    marginTop: spacing.xs,
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginVertical: spacing.md,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.xs,
  },
  quickActionButton: {
    width: CARD_WIDTH,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  quickActionLabel: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.xs,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  recentActivityContainer: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  activityDescription: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  activityTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    opacity: 0.7,
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapHint: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xs,
    opacity: 0.7,
  },
  feedSection: {
    marginBottom: spacing.lg,
  },
  feedContainer: {
    gap: spacing.md,
  },
  travelerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  deliveryCount: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  tripRoute: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  locations: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  location: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flex: 1,
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  contactButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  viewDetailsText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
});

export default SenderDashboard; 