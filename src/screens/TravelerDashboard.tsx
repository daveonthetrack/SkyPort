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
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withDelay,
  Layout
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, HomeStackScreenProps, TabParamList, MessagesStackParamList } from '../navigation/types';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { format, formatDistanceToNow } from 'date-fns';
import { RealtimeChannel } from '@supabase/supabase-js';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Trip, Item } from '../types/models';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: CompositeNavigationProp<
    NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>,
    BottomTabNavigationProp<TabParamList>
  >;
  route: RouteProp<HomeStackParamList, 'Dashboard'>;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.md * 3) / 2;

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

const QuickActionButton = ({ icon, label, onPress }: QuickActionProps) => (
  <TouchableOpacity
    style={styles.quickActionButton}
    onPress={onPress}
  >
    <LinearGradient
      colors={[colors.primary, colors.secondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.quickActionGradient}
    >
      <Ionicons name={icon} size={24} color={colors.white} />
    </LinearGradient>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

type StatCardProps = {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  details?: string;
};

type ActivityItem = {
  id: string;
  type: 'trip_posted' | 'item_accepted' | 'delivery_completed' | 'message_received';
  title: string;
  description: string;
  timestamp: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const StatCard = ({ title, value, icon, onPress, details }: StatCardProps) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95);
  };

  const onPressOut = () => {
    scale.value = withSpring(1);
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
      <Animated.View style={[styles.statCard, animatedStyle]}>
        <View style={styles.statIconContainer}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const ActivityListItem = ({ item }: { item: ActivityItem }) => (
  <Animated.View 
    entering={FadeInDown.delay(200).springify()} 
    style={styles.activityItem}
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

const AnimatedTextWrapper = Animated.createAnimatedComponent(Text);

// Update the Item type to include owner
interface ExtendedItem extends Item {
  owner?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

const TravelerDashboard = ({ navigation, route }: Props) => {
  const tabNavigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { session, signOut, profile } = useAuth();
  const [stats, setStats] = useState({
    activeTrips: 0,
    itemsCarrying: 0,
    completedDeliveries: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [upcomingTrips, setUpcomingTrips] = useState(0);
  const [completedTrips, setCompletedTrips] = useState(0);
  const [items, setItems] = useState<ExtendedItem[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    
    // Initial data load
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchDashboardStats(),
          fetchRecentActivity(),
          fetchItems()
        ]);
        setInitialLoadComplete(true);
      } catch (error) {
        console.error('Error loading initial dashboard data:', error);
      }
    };
    
    loadInitialData();
    
    // Set up realtime subscriptions after initial load
    const setupRealtimeSubscriptions = () => {
      console.log('Setting up realtime subscriptions for dashboard...');
      
      // Subscribe to items table changes (for items carrying & completed deliveries)
      const itemsChannel = supabase
        .channel('traveler-dashboard-items')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `carrier_id=eq.${session.user.id}`
        }, () => {
          console.log('Items table changed, refreshing stats...');
          fetchDashboardStats();
          fetchRecentActivity();
          fetchItems();
        })
        .subscribe((status: string) => {
          console.log('Items subscription status:', status);
        });
      
      // Subscribe to trips table changes (for active trips)
      const tripsChannel = supabase
        .channel('traveler-dashboard-trips')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: `user_id=eq.${session.user.id}`
        }, () => {
          console.log('Trips table changed, refreshing stats...');
          fetchDashboardStats();
          fetchRecentActivity();
        })
        .subscribe((status: string) => {
          console.log('Trips subscription status:', status);
        });
      
      // Return cleanup function
      return () => {
        console.log('Cleaning up realtime subscriptions...');
        supabase.removeChannel(itemsChannel);
        supabase.removeChannel(tripsChannel);
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
      console.log('Fetching dashboard stats...');
      
      // Fetch active trips (trips with status 'active' or 'pending')
      const { data: trips, error: tripsError } = await supabase
        .from('trips')
        .select('id, status, created_at, departure_date, return_date')
        .eq('user_id', session.user.id);
        
      if (tripsError) throw tripsError;
      
      const activeTrips = trips?.filter(
        (trip: { status: string; }) => trip.status === 'active' || trip.status === 'pending'
      ).length || 0;
      
      // Count upcoming trips (future departure date)
      const today = new Date();
      const upcomingTripsCount = trips?.filter(
        (trip: { departure_date: string; }) => new Date(trip.departure_date) > today
      ).length || 0;
      setUpcomingTrips(upcomingTripsCount);
      
      // Count completed trips
      const completedTripsCount = trips?.filter(
        (trip: { status: string; }) => trip.status === 'completed'
      ).length || 0;
      setCompletedTrips(completedTripsCount);

      // Fetch items being carried (accepted items)
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, status')
        .eq('accepted_by', session.user.id);
        
      if (itemsError) throw itemsError;
      
      const itemsCarrying = items?.filter(
        (item: { status: string; }) => item.status === 'accepted'
      ).length || 0;
      
      // Fetch completed deliveries
      const completedDeliveries = items?.filter(
        (item: { status: string; }) => item.status === 'delivered'
      ).length || 0;

      const newStats = {
        activeTrips,
        itemsCarrying,
        completedDeliveries,
      };
      
      console.log('Dashboard stats updated:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      Alert.alert('Error', 'Failed to load dashboard statistics');
    }
  };

  const fetchRecentActivity = async () => {
    if (!session?.user?.id) return;

    try {
      // Fetch recent trips
      const { data: trips } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent item acceptances
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('carrier_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(2);

      const activity: ActivityItem[] = [
        ...(trips?.map((trip: any) => ({
          id: `trip-${trip.id}`,
          type: 'trip_posted' as const,
          title: 'New Trip Posted',
          description: `${trip.origin} → ${trip.destination}`,
          timestamp: trip.created_at,
          icon: 'airplane-outline' as const
        })) || []),
        ...(items?.map((item: any) => ({
          id: `item-${item.id}`,
          type: 'item_accepted' as const,
          title: 'Item Accepted',
          description: item.title || '',
          timestamp: item.updated_at,
          icon: 'cube-outline' as const
        })) || [])
      ].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 4);

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const fetchItems = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(`
          *,
          owner:profiles!user_id(
            id,
            name,
            avatar_url
          )
        `)
        .eq('accepted_by', session.user.id)
        .neq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Ensure all dates are valid before setting state
      const validItems = items?.map(item => ({
        ...item,
        created_at: item.created_at ? new Date(item.created_at).toISOString() : new Date().toISOString()
      })) || [];

      setItems(validItems as ExtendedItem[]);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const handleSeeAll = (type: 'active' | 'completed') => {
    navigation.navigate('Messages', {
      screen: 'ChatList',
      params: { type }
    });
  };

  const renderItemCard = (item: ExtendedItem) => {
    const formattedDate = item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : 'Just now';
    
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => navigation.navigate('TravelerItemDetails', { itemId: item.id.toString() })}
      >
        <View style={styles.itemCardContent}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
            style={styles.itemImage}
          />
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'accepted' ? colors.success + '15' : colors.primary + '15' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: item.status === 'accepted' ? colors.success : colors.primary }
                ]}>
                  {item.status === 'accepted' ? 'In Transit' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.itemMeta}>
              <View style={styles.itemLocation}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.itemLocationText} numberOfLines={1}>
                  {item.pickup_location} → {item.destination}
                </Text>
              </View>
              <View style={styles.itemDetails}>
                <View style={styles.detailItem}>
                  <Ionicons 
                    name={item.size === 'small' ? 'cube-outline' : 
                          item.size === 'medium' ? 'cube' : 'cube-sharp'} 
                    size={16} 
                    color={colors.text.secondary} 
                  />
                  <Text style={styles.detailText}>
                    {item.size.charAt(0).toUpperCase() + item.size.slice(1)} Package
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.userInfo}>
                <Image
                  source={{ uri: item.owner?.avatar_url || 'https://via.placeholder.com/40' }}
                  style={styles.userAvatar}
                />
                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.owner?.name || 'Unknown'}
                  </Text>
                  <Text style={styles.itemTime}>Picked up {formattedDate}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => navigation.navigate('TravelerItemDetails', { itemId: item.id.toString() })}
              >
                <Text style={styles.viewDetailsText}>Details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const menuOptions = [
    {
      icon: 'cube-outline' as const,
      label: 'Delivered Items',
      onPress: () => {
        setIsMenuVisible(false);
        navigation.navigate('DeliveredItems');
      },
    },
    {
      icon: 'person-outline' as const,
      label: 'Profile',
      onPress: () => {
        setIsMenuVisible(false);
        navigation.navigate('Profile');
      },
    },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      onPress: () => {
        setIsMenuVisible(false);
        Alert.alert('Coming Soon', 'Settings will be available in the next update.');
      },
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => {
        setIsMenuVisible(false);
        Alert.alert('Coming Soon', 'Help & Support will be available in the next update.');
      },
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'About',
      onPress: () => {
        setIsMenuVisible(false);
        Alert.alert(
          'About BagMe',
          'BagMe helps travelers earn money by delivering items while traveling. Version 1.0.0'
        );
      },
    },
  ];

  const renderMenu = () => (
    <Modal
      visible={isMenuVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsMenuVisible(false)}
    >
      <TouchableOpacity
        style={styles.menuOverlay}
        activeOpacity={1}
        onPress={() => setIsMenuVisible(false)}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity
              onPress={() => setIsMenuVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {menuOptions.map((option, index) => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.menuOption,
                index === menuOptions.length - 1 && styles.menuOptionLast,
              ]}
              onPress={option.onPress}
            >
              <Ionicons name={option.icon} size={24} color={colors.primary} />
              <Text style={styles.menuOptionText}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      onRefresh();
    }, [])
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
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setIsMenuVisible(true)}
              style={styles.menuButton}
            >
              <Ionicons name="menu" size={24} color={colors.white} />
            </TouchableOpacity>
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
                style={styles.userNameAnimated}
              >
                {profile?.name || session?.user?.email?.split('@')[0]}
              </AnimatedTextWrapper>
            </View>
          </View>
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
            icon="airplane-outline"
            label="Post Trip"
            onPress={() => navigation.navigate('PostTrip', undefined)}
          />
          <QuickActionButton
            icon="list-outline"
            label="My Trips"
            onPress={() => navigation.navigate('MyTrips', undefined)}
          />
          <QuickActionButton
            icon="cube-outline"
            label="Find Items"
            onPress={() => navigation.navigate('FindItems', {})}
          />
          <QuickActionButton
            icon="chatbubbles-outline"
            label="Messages"
            onPress={() => navigation.navigate('Messages', { screen: 'ChatList' })}
          />
        </View>

        <View style={styles.feedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Picked Up Items</Text>
            
          </View>
          
          <View style={styles.feedContainer}>
            {items.map((item) => (
              <Animated.View
                key={item.id}
                entering={FadeInUp.delay(200).springify()}
              >
                {renderItemCard(item)}
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
            title="Active Trips"
            value={stats.activeTrips}
            icon="airplane"
            details={`You currently have ${stats.activeTrips} active trips.\n\nThese trips are currently in progress and you can still accept items for delivery.`}
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

      {renderMenu()}
    </ScrollView>
  );
};

export default TravelerDashboard;

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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  welcomeText: {
    fontSize: typography.sizes.lg,
    color: colors.white,
    opacity: 0.9,
  },
  userNameAnimated: {
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
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  itemCardContent: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  itemMeta: {
    marginBottom: spacing.md,
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  itemLocationText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.primary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary + '20',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemTime: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '05',
  },
  viewDetailsText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.large,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuOptionLast: {
    borderBottomWidth: 0,
  },
  menuOptionText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
}); 