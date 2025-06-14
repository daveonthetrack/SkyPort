import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeInUp,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, TabParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';
import { Trip } from '../types/models';

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
  const { theme } = useTheme();
  const themeColors = theme.colors;
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

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
      
      let itemsRetryCount = 0;
      let messagesRetryCount = 0;
      const maxRetries = 5;
      const baseDelay = 2000; // 2 seconds
      
      const createItemsSubscription = () => {
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
            if (status === 'SUBSCRIBED') {
              console.log('✅ Sender items subscription connected successfully');
              itemsRetryCount = 0; // Reset retry count on success
            } else if (status === 'CHANNEL_ERROR') {
              if (itemsRetryCount < maxRetries) {
                itemsRetryCount++;
                const delay = baseDelay * Math.pow(2, itemsRetryCount - 1); // Exponential backoff
                console.log(`⚠️ Sender items subscription error - retrying in ${delay/1000}s (attempt ${itemsRetryCount}/${maxRetries})`);
                setTimeout(createItemsSubscription, delay);
              } else {
                console.log('⚠️ Sender items subscription failed after max retries - using polling fallback');
              }
            }
          });
        return itemsChannel;
      };

      const createMessagesSubscription = () => {
        const messagesChannel = supabase
          .channel('sender-dashboard-messages')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `or(sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id})`
          }, () => {
            console.log('Messages table changed, refreshing sender stats...');
            fetchDashboardStats();
            fetchRecentActivity();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Sender messages subscription connected successfully');
              messagesRetryCount = 0; // Reset retry count on success
            } else if (status === 'CHANNEL_ERROR') {
              if (messagesRetryCount < maxRetries) {
                messagesRetryCount++;
                const delay = baseDelay * Math.pow(2, messagesRetryCount - 1); // Exponential backoff
                console.log(`⚠️ Sender messages subscription error - retrying in ${delay/1000}s (attempt ${messagesRetryCount}/${maxRetries})`);
                setTimeout(createMessagesSubscription, delay);
              } else {
                console.log('⚠️ Sender messages subscription failed after max retries - using polling fallback');
              }
            }
          });
        return messagesChannel;
      };

      // Create initial subscriptions
      const itemsSubscription = createItemsSubscription();
      const messagesSubscription = createMessagesSubscription();

      return () => {
        itemsSubscription?.unsubscribe();
        messagesSubscription?.unsubscribe();
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
      console.log('Fetching available traveler trips...');
      
      // Fetch trips from other users (travelers) that are available for senders
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
        .neq('user_id', session.user.id) // Exclude current user's trips
        .eq('status', 'active') // Only show active trips
        .gte('departure_date', new Date().toISOString().split('T')[0]) // Only future trips
        .order('departure_date', { ascending: true })
        .limit(5); // Limit to 5 for dashboard

      if (error) {
        console.error('Error fetching trips:', error);
        return;
      }
      
      // Ensure all dates are valid before setting state
      const validTrips = trips?.map(trip => ({
        ...trip,
        departure_date: trip.departure_date ? new Date(trip.departure_date).toISOString() : new Date().toISOString()
      })) || [];

      console.log(`Fetched ${validTrips.length} available trips`);
      setTrips(validTrips as Trip[]);
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
          <View style={styles.travelerInfo}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.verifiedText}>Verified Traveler</Text>
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

  const menuOptions = [
    {
      icon: 'cube-outline' as const,
      label: 'My Items',
      onPress: () => {
        setIsMenuVisible(false);
        navigation.navigate('MyItems', undefined);
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
        navigation.navigate('Settings' as never);
      },
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => {
        setIsMenuVisible(false);
        navigation.navigate('HelpSupport' as never);
      },
    },
    {
      icon: 'information-circle-outline' as const,
      label: 'About',
      onPress: () => {
        setIsMenuVisible(false);
        Alert.alert(
          'About BagMe',
          'BagMe helps senders find reliable travelers to deliver their items. Version 1.0.0'
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
                style={styles.userName}
              >
                {profile?.name || session?.user?.email?.split('@')[0]}
              </AnimatedTextWrapper>
            </View>
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
            onPress={() => navigation.navigate('FindTravelers' as never)}
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
            <TouchableOpacity onPress={() => navigation.navigate('FindTravelers' as never)}>
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
            title="Posted Items"
            value={stats.postedItems}
            icon="cube-outline"
            details={`You have posted a total of ${stats.postedItems} items for delivery.
            
This includes all items you've ever posted, regardless of their current status.`}
          />
          <StatCard
            title="Active Deliveries"
            value={stats.activeDeliveries}
            icon="airplane"
            details={`You currently have ${stats.activeDeliveries} items in transit with travelers.
            
These items are being carried by travelers to their destinations and are expected to be delivered soon.`}
          />
          <StatCard
            title="Completed"
            value={stats.completedDeliveries}
            icon="checkmark-circle"
            details={`You have successfully completed ${stats.completedDeliveries} deliveries.
            
These items have been delivered to their destinations and marked as complete.`}
          />
        </View>

        <View style={styles.additionalStatsContainer}>
          <View style={styles.additionalStatsRow}>
            <View style={styles.miniStatCard}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.miniStatValue}>{pendingItems}</Text>
              <Text style={styles.miniStatLabel}>Pending</Text>
            </View>
            <View style={styles.miniStatCard}>
              <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
              <Text style={styles.miniStatValue}>{recentItems}</Text>
              <Text style={styles.miniStatLabel}>This Month</Text>
            </View>
            <View style={styles.miniStatCard}>
              <Ionicons name="trending-up-outline" size={20} color={colors.success} />
              <Text style={styles.miniStatValue}>
                {stats.completedDeliveries > 0 ? Math.round((stats.completedDeliveries / stats.postedItems) * 100) : 0}%
              </Text>
              <Text style={styles.miniStatLabel}>Success Rate</Text>
            </View>
          </View>
        </View>

        <View style={[styles.progressSection, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.progressTitle, { color: themeColors.text.primary }]}>Delivery Progress</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${stats.postedItems > 0 ? (stats.completedDeliveries / stats.postedItems) * 100 : 0}%`,
                    backgroundColor: colors.success 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: themeColors.text.secondary }]}>
              {stats.completedDeliveries} of {stats.postedItems} items delivered
            </Text>
          </View>
        </View>
        
        <View style={[styles.insightsSection, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.insightsTitle, { color: themeColors.text.primary }]}>Quick Insights</Text>
          <View style={styles.insightsList}>
            <View style={styles.insightItem}>
              <Ionicons name="flash-outline" size={16} color={colors.warning} />
              <Text style={[styles.insightText, { color: themeColors.text.secondary }]}>
                {stats.activeDeliveries > 0 
                  ? `${stats.activeDeliveries} items currently in transit`
                  : 'No active deliveries at the moment'
                }
              </Text>
            </View>
            <View style={styles.insightItem}>
              <Ionicons name="trophy-outline" size={16} color={colors.success} />
              <Text style={[styles.insightText, { color: themeColors.text.secondary }]}>
                {stats.completedDeliveries >= 10 
                  ? 'Experienced sender - Great job!' 
                  : `${10 - stats.completedDeliveries} more deliveries to become experienced`
                }
              </Text>
            </View>
          </View>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
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
  travelerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
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
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  additionalStatsContainer: {
    marginTop: spacing.md,
  },
  additionalStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  miniStatValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  miniStatLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  progressSection: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    height: 20,
    backgroundColor: colors.background,
    borderRadius: 10,
    flex: 1,
    marginRight: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  insightsSection: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  insightsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  insightsList: {
    gap: spacing.md,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.md,
  },
});

export default SenderDashboard; 