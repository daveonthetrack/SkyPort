import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { useDID } from '../contexts/DIDContext';
import { supabase } from '../lib/supabase';
import {
  getVerificationStatus,
  type VerificationStatus
} from '../lib/verification';
import { borderRadius, colors, shadows, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Profile Stack navigation type
type ProfileStackParamList = {
  ProfileMain: undefined;
  EmailVerification: undefined;
  PhoneVerification: {
    phoneNumber: string;
  };
  IdVerification: undefined;
  DIDOnboarding: undefined;
  HandoverTest: undefined;
};

// Enhanced types
type TrustLevel = 'basic' | 'silver' | 'gold' | 'platinum';
type ActivityType = 'delivery' | 'verification' | 'rating' | 'achievement';

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  date: string;
  icon: string;
  color: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

// Enhanced Trust Badge Component with Animations
const TrustBadge = React.memo(({ level, score }: { level: TrustLevel; score: number }) => {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  const getBadgeConfig = () => {
    switch (level) {
      case 'platinum': return { color: '#E5E4E2', icon: 'diamond', gradient: ['#E5E4E2', '#C0C0C0'] as const };
      case 'gold': return { color: '#FFD700', icon: 'shield-checkmark', gradient: ['#FFD700', '#FFA500'] as const };
      case 'silver': return { color: '#C0C0C0', icon: 'shield-half', gradient: ['#C0C0C0', '#A0A0A0'] as const };
      case 'basic':
      default: return { color: '#CD7F32', icon: 'shield-outline', gradient: ['#CD7F32', '#8B4513'] as const };
    }
  };

  const config = getBadgeConfig();

  // Animate badge entrance and score count-up
  useEffect(() => {
    scale.value = withDelay(300, withSpring(1, { damping: 15, stiffness: 150 }));
    rotation.value = withSequence(
      withTiming(10, { duration: 100 }),
      withTiming(-10, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );

    // Count up animation for score
    const timer = setInterval(() => {
      setDisplayScore(prev => {
        if (prev >= score) {
          clearInterval(timer);
          return score;
        }
        return prev + 1;
      });
    }, 20);

    return () => clearInterval(timer);
  }, [score]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));

  return (
    <Reanimated.View style={animatedStyle}>
      <LinearGradient
        colors={config.gradient}
        style={styles.trustBadge}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={config.icon as any} size={16} color="#FFFFFF" />
        <Text style={styles.trustBadgeText}>
          {level.charAt(0).toUpperCase() + level.slice(1)}
        </Text>
        <Text style={styles.trustScore}>{displayScore}%</Text>
      </LinearGradient>
    </Reanimated.View>
  );
});

// Enhanced Verification Option Component
const VerificationOption = React.memo(({ 
  title, 
  subtitle, 
  icon, 
  isVerified,
  onPress,
  progress 
}: { 
  title: string; 
  subtitle: string; 
  icon: string; 
  isVerified: boolean;
  onPress: () => void;
  progress?: number;
}) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        style={[styles.verificationOption, isVerified && styles.verifiedOption]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <View style={[styles.verificationIconContainer, isVerified && styles.verifiedIconContainer]}>
          <Ionicons 
            name={icon as any} 
            size={24} 
            color={isVerified ? '#FFFFFF' : colors.primary} 
          />
        </View>
        <View style={styles.verificationText}>
          <View style={styles.verificationTitleRow}>
            <Text style={styles.verificationTitle}>{title}</Text>
            {isVerified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#32CD32" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : (
              <Text style={styles.notVerifiedText}>Tap to verify</Text>
            )}
          </View>
          <Text style={styles.verificationSubtitle}>{subtitle}</Text>
          {progress !== undefined && !isVerified && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}% complete</Text>
            </View>
          )}
        </View>
        <Ionicons 
          name={isVerified ? "checkmark-circle" : "chevron-forward"} 
          size={20} 
          color={isVerified ? "#32CD32" : colors.text.secondary} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

// Enhanced Stats Card Component with Animations
const StatsCard = React.memo(({ title, value, icon, color, trend, index = 0 }: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: { value: number; isPositive: boolean };
  index?: number;
}) => {
  const scale = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'string' ? parseInt(value.replace(/\D/g, '')) || 0 : value;

  useEffect(() => {
    // Staggered entrance animation
    scale.value = withDelay(
      index * 100,
      withSpring(1, { damping: 15, stiffness: 150 })
    );

    // Count up animation for numeric values
    if (typeof numericValue === 'number' && numericValue > 0) {
      const duration = Math.min(numericValue * 30, 1000); // Max 1 second
      const steps = Math.min(numericValue, 50); // Max 50 steps
      const increment = numericValue / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.min(Math.round(increment * currentStep), numericValue);
        setDisplayValue(newValue);
        
        if (currentStep >= steps) {
          clearInterval(timer);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [numericValue, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDisplayValue = () => {
    if (typeof value === 'string') {
      if (value.includes('%')) {
        return `${displayValue}%`;
      }
      if (value.includes('/')) {
        return value; // Keep original format for ratios
      }
    }
    return displayValue;
  };

  return (
    <Reanimated.View style={[styles.statsCard, animatedStyle]}>
      <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.statsValue}>
        {typeof value === 'number' || (typeof value === 'string' && value.includes('%')) 
          ? formatDisplayValue() 
          : value}
      </Text>
      <Text style={styles.statsTitle}>{title}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          <Ionicons 
            name={trend.isPositive ? "trending-up" : "trending-down"} 
            size={12} 
            color={trend.isPositive ? "#32CD32" : "#FF3B30"} 
          />
          <Text style={[styles.trendText, { color: trend.isPositive ? "#32CD32" : "#FF3B30" }]}>
            {trend.value}%
          </Text>
        </View>
      )}
    </Reanimated.View>
  );
});

// Activity Item Component
const ActivityItem = React.memo(({ activity }: { activity: Activity }) => {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: activity.color + '20' }]}>
        <Ionicons name={activity.icon as any} size={20} color={activity.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activityDescription}>{activity.description}</Text>
        <Text style={styles.activityDate}>{activity.date}</Text>
      </View>
    </View>
  );
});

// Achievement Badge Component
const AchievementBadge = React.memo(({ achievement }: { achievement: Achievement }) => {
  return (
    <View style={[styles.achievementBadge, !achievement.unlocked && styles.lockedAchievement]}>
      <Ionicons 
        name={achievement.icon as any} 
        size={24} 
        color={achievement.unlocked ? "#FFD700" : "#CCCCCC"} 
      />
      <Text style={[styles.achievementTitle, !achievement.unlocked && styles.lockedText]}>
        {achievement.title}
      </Text>
      {achievement.progress !== undefined && achievement.maxProgress && (
        <View style={styles.achievementProgress}>
          <View style={styles.achievementProgressBar}>
            <View 
              style={[
                styles.achievementProgressFill, 
                { width: `${(achievement.progress / achievement.maxProgress) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.achievementProgressText}>
            {achievement.progress}/{achievement.maxProgress}
          </Text>
        </View>
      )}
    </View>
  );
});

export default function ProfileScreen() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const { didProfile, hasDID } = useDID();
  const navigation = useNavigation<NavigationProp<ProfileStackParamList>>();
  
  // Debug logging for profile data
  useEffect(() => {
    console.log('ProfileScreen - Profile data:', {
      profile,
      avatar_url: profile?.avatar_url,
      hasProfile: !!profile,
      profileKeys: profile ? Object.keys(profile) : 'no profile'
    });
  }, [profile]);

  // State
  const [name, setName] = useState(profile?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'achievements'>('overview');
  const [isTraveler, setIsTraveler] = useState(profile?.role === 'traveler');
  const [changingRole, setChangingRole] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarRetryCount, setAvatarRetryCount] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    isEmailVerified: false,
    isPhoneVerified: false,
    isIdVerified: false,
    isSocialConnected: false,
    trustLevel: 0
  });

  // Animation values for enhanced interactions
  const tabIndicatorPosition = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const avatarScale = useSharedValue(1);

  // Real data for enhanced features
  const [activities, setActivities] = useState<Activity[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Load real activity data
  const loadRecentActivities = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoadingActivities(true);
      
      // Fetch recent items and trips for activity
      const [itemsResult, tripsResult] = await Promise.all([
        supabase
          .from('items')
          .select('id, title, status, created_at, updated_at')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('trips')
          .select('id, origin, destination, status, created_at, updated_at')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .limit(3)
      ]);

      const activities: Activity[] = [];

      // Add item activities
      if (itemsResult.data) {
        itemsResult.data.forEach(item => {
          activities.push({
            id: `item-${item.id}`,
            type: item.status === 'delivered' ? 'delivery' : 'verification',
            title: item.status === 'delivered' ? 'Delivery Completed' : 'Item Posted',
            description: item.title,
            date: formatDistanceToNow(new Date(item.updated_at || item.created_at), { addSuffix: true }),
            icon: item.status === 'delivered' ? 'checkmark-circle' : 'cube',
            color: item.status === 'delivered' ? '#32CD32' : '#007AFF'
          });
        });
      }

      // Add trip activities
      if (tripsResult.data) {
        tripsResult.data.forEach(trip => {
          activities.push({
            id: `trip-${trip.id}`,
            type: 'verification',
            title: 'Trip Posted',
            description: `${trip.origin} → ${trip.destination}`,
            date: formatDistanceToNow(new Date(trip.updated_at || trip.created_at), { addSuffix: true }),
            icon: 'airplane',
            color: '#FFD700'
          });
        });
      }

      // Sort by most recent
      activities.sort((a, b) => {
        const dateA = new Date(a.date.includes('ago') ? Date.now() : a.date);
        const dateB = new Date(b.date.includes('ago') ? Date.now() : b.date);
        return dateB.getTime() - dateA.getTime();
      });

      setActivities(activities.slice(0, 5));

      // Load achievements based on real data
      const completedDeliveries = profile?.completed_deliveries || 0;
      const verificationCount = getVerificationCount();
      
      setAchievements([
        {
          id: '1',
          title: 'First Delivery',
          description: 'Complete your first delivery',
          icon: 'trophy',
          unlocked: completedDeliveries > 0
        },
        {
          id: '2',
          title: 'Trusted Member',
          description: 'Complete account verification',
          icon: 'shield-checkmark',
          unlocked: verificationCount >= 3,
          progress: verificationCount,
          maxProgress: 4
        },
        {
          id: '3',
          title: 'Active User',
          description: 'Complete 5 deliveries',
          icon: 'star',
          unlocked: completedDeliveries >= 5,
          progress: Math.min(completedDeliveries, 5),
          maxProgress: 5
        }
      ]);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  }, [session?.user?.id, profile?.completed_deliveries, verificationStatus]);

  // Load activities when profile data is available
  useEffect(() => {
    if (profile && verificationStatus) {
      loadRecentActivities();
    }
  }, [profile, verificationStatus, loadRecentActivities]);

  // Effects
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhoneNumber(profile.phone_number || '');
      setIsTraveler(profile.role === 'traveler');
      setAvatarError(false);
      setAvatarRetryCount(0);
    }
  }, [profile]);

  useEffect(() => {
    if (session?.user?.id) {
      loadVerificationStatus();
      loadRealtimeStats();
      
      // Set up real-time subscription for profile updates
      const profileSubscription = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${session.user.id}`,
          },
          (payload) => {
            console.log('Profile updated in real-time:', payload);
            refreshProfile();
          }
        )
        .subscribe();

      // Listen for auth state changes to detect email verification
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          console.log('Auth state changed:', event);
          
          // Check if email was just verified
          if (session?.user?.email_confirmed_at && !verificationStatus.isEmailVerified) {
            console.log('Email verification detected, updating profile...');
            
            try {
              // Update the profile to mark email as verified
              const { error } = await supabase
                .from('profiles')
                .update({ 
                  is_email_verified: true,
                  updated_at: new Date().toISOString()
                })
                .eq('id', session.user.id);
                
              if (error) {
                console.error('Error updating email verification status:', error);
              } else {
                // Refresh verification status
                await loadVerificationStatus();
                await refreshProfile();
                
                Alert.alert(
                  'Email Verified!',
                  'Your email address has been successfully verified. Your trust score has been updated.',
                  [{ text: 'Great!' }]
                );
              }
            } catch (error) {
              console.error('Error handling email verification:', error);
            }
          }
        }
      });

      return () => {
        profileSubscription.unsubscribe();
        subscription.unsubscribe();
      };
    }
  }, [session?.user?.id, verificationStatus.isEmailVerified]);

  // Functions
  const loadVerificationStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      const status = await getVerificationStatus(session.user.id);
      setVerificationStatus(status);
    } catch (error) {
      console.error('Error loading verification status:', error);
    }
  }, [session?.user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Add haptic feedback for better UX
      if (Platform.OS === 'ios') {
        // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      await Promise.all([
        refreshProfile(),
        loadVerificationStatus(),
        loadRealtimeStats()
      ]);
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Alert.alert('Error', 'Failed to refresh profile data');
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, loadVerificationStatus]);

  // Enhanced real-time stats loading
  const loadRealtimeStats = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      // Check if user has any items or trips data instead of deliveries table
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, status, created_at')
        .eq('user_id', session.user.id);

      if (itemsError) {
        console.warn('Items table query failed:', itemsError.message);
        return;
      }

      // Update profile with real-time data
      if (items) {
        const completedCount = items.filter(item => item.status === 'delivered').length;
        console.log('Real-time items count:', completedCount);
      }
    } catch (error) {
      console.warn('Error loading real-time stats:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [session?.user?.id]);

  const handleUpdateProfile = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    try {
      setLoading(true);
      const updateData: any = {
        name: name.trim(),
        phone_number: phoneNumber.trim(),
        updated_at: new Date().toISOString(),
      };

      // Only update fields that exist in the database
      // Remove bio, location, emergency_contact, preferred_language as they don't exist in the profiles table

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload an image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      await uploadImage(result.assets[0].uri);
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    try {
      setUploading(true);
      console.log('Starting simple image upload for user:', session.user.id);

      const fileExt = uri.split('.').pop();
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

      console.log('Upload details:', { fileName, uri });

      // Simple FormData approach - the standard React Native way
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'image/jpeg',
        name: fileName,
      } as any);

      // Upload directly to Supabase storage using their REST API
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      // Use the public storage URL format
      const storageUrl = 'https://oymorekjkudgxwofejbq.supabase.co/storage/v1/object/avatars/' + fileName;
      
      const uploadResponse = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession?.access_token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      console.log('Upload successful!');

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const getTrustLevel = (): TrustLevel => {
    const score = verificationStatus.trustLevel;
    if (score >= 90) return 'platinum';
    if (score >= 70) return 'gold';
    if (score >= 40) return 'silver';
    return 'basic';
  };

  const getVerificationCount = () => {
    return [
      verificationStatus.isEmailVerified,
      verificationStatus.isPhoneVerified,
      verificationStatus.isIdVerified,
      verificationStatus.isSocialConnected,
      !!didProfile
    ].filter(Boolean).length;
  };

  const handleVerificationRequest = async (type: string) => {
    if (type === 'email') {
      handleEmailVerification();
    } else if (type === 'phone') {
      handlePhoneVerification();
    } else if (type === 'id') {
      handleIdVerification();
    } else {
      Alert.alert('Verification', `${type} verification will be implemented`);
    }
  };

  const handleEmailVerification = async () => {
    if (!session?.user?.email) {
      Alert.alert('Error', 'No email address found in your account');
      return;
    }

    if (verificationStatus.isEmailVerified) {
      Alert.alert('Already Verified', 'Your email address is already verified');
      return;
    }

    // Navigate to dedicated email verification screen
    navigation.navigate('EmailVerification');
  };

  const handlePhoneVerification = async () => {
    if (!profile?.phone_number) {
      Alert.alert(
        'Phone Number Required',
        'Please add a phone number to your profile first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Phone Number', onPress: () => {
            // Focus on phone number input
            // You could scroll to the phone input or highlight it
          }}
        ]
      );
      return;
    }

    if (verificationStatus.isPhoneVerified) {
      Alert.alert('Already Verified', 'Your phone number is already verified');
      return;
    }

    // Navigate to phone verification screen
    navigation.navigate('PhoneVerification', { phoneNumber: profile.phone_number });
  };

  const handleIdVerification = async () => {
    if (verificationStatus.isIdVerified) {
      Alert.alert('Already Verified', 'Your ID is already verified');
      return;
    }

    // Navigate to dedicated ID verification screen
    navigation.navigate('IdVerification');
  };

  const handleDIDVerification = async () => {
    navigation.navigate('DIDOnboarding');
  };

  const handleHandoverTest = () => {
    navigation.navigate('HandoverTest');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: signOut 
        }
      ]
    );
  };

  // Function to get avatar URL with cache-busting
  const getAvatarUrl = () => {
    if (!profile?.avatar_url) return null;
    
    // Add cache-busting parameter to force reload
    const separator = profile.avatar_url.includes('?') ? '&' : '?';
    return `${profile.avatar_url}${separator}t=${Date.now()}&retry=${avatarRetryCount}`;
  };

  // Function to retry avatar loading
  const retryAvatarLoad = () => {
    if (avatarRetryCount < 3) {
      setAvatarRetryCount(prev => prev + 1);
      setAvatarError(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset all fields to original values
    if (profile) {
      setName(profile.name || '');
      setPhoneNumber(profile.phone_number || '');
    }
    setIsEditMode(false);
  };

  const handleSaveProfile = async () => {
    await handleUpdateProfile();
    if (!loading) {
      setIsEditMode(false);
    }
  };

  const handleRoleChange = async (newRole: 'sender' | 'traveler') => {
    if (!session?.user?.id || changingRole) return;
    
    if (newRole === profile?.role) return; // No change needed
    
    try {
      setChangingRole(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      await refreshProfile();
      setIsTraveler(newRole === 'traveler');
      
      Alert.alert(
        'Role Updated',
        `Your account type has been changed to ${newRole === 'traveler' ? 'Traveler' : 'Sender'}.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Error updating role:', error);
      Alert.alert('Error', error.message || 'Failed to update account type');
    } finally {
      setChangingRole(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'activity':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {loadingActivities ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading activities...</Text>
              </View>
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color={colors.text.secondary} />
                <Text style={styles.emptyStateTitle}>No Recent Activity</Text>
                <Text style={styles.emptyStateText}>
                  Your recent activities will appear here once you start using the app.
                </Text>
              </View>
            )}
          </View>
        );
      
      case 'achievements':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            {achievements.length > 0 ? (
              <View style={styles.achievementsGrid}>
                {achievements.map((achievement) => (
                  <AchievementBadge key={achievement.id} achievement={achievement} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={colors.text.secondary} />
                <Text style={styles.emptyStateTitle}>No Achievements Yet</Text>
                <Text style={styles.emptyStateText}>
                  Complete deliveries and verify your account to unlock achievements.
                </Text>
              </View>
            )}
          </View>
        );
      
      default:
        return (
          <>
            {/* Enhanced Account Details Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="person-circle" size={24} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => isEditMode ? handleCancelEdit() : setIsEditMode(true)}
                >
                  <Ionicons 
                    name={isEditMode ? "close" : "pencil"} 
                    size={18} 
                    color={isEditMode ? "#FF3B30" : colors.primary} 
                  />
                  <Text style={[styles.editButtonText, isEditMode && styles.cancelButtonText]}>
                    {isEditMode ? 'Cancel' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Basic Info */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name *</Text>
                {isEditMode ? (
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your full name"
                    maxLength={50}
                  />
                ) : (
                  <View style={styles.profileCard}>
                    <Ionicons name="person" size={22} color={colors.primary} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Full Name</Text>
                      <Text style={styles.cardValue}>{name || 'Not set'}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.profileCard}>
                  <Ionicons name="mail" size={22} color={colors.primary} />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>Email Address</Text>
                    <Text style={styles.cardValue}>{session?.user?.email}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                {isEditMode ? (
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Enter your phone number"
                    keyboardType="phone-pad"
                    maxLength={20}
                  />
                ) : (
                  <View style={styles.profileCard}>
                    <Ionicons name="call" size={22} color={colors.primary} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardLabel}>Phone Number</Text>
                      <Text style={styles.cardValue}>{phoneNumber || 'Not set'}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Account Type</Text>
                <View style={styles.profileCard}>
                  <Ionicons 
                    name={profile?.role === 'traveler' ? "airplane" : "cube"} 
                    size={22} 
                    color={colors.primary} 
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>Account Type</Text>
                    <Text style={styles.cardValue}>
                      {profile?.role === 'traveler' ? 'Traveler' : 'Sender'}
                    </Text>
                  </View>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {profile?.role === 'traveler' ? '✈️' : '📦'}
                    </Text>
                  </View>
                </View>
                {isEditMode && (
                  <View style={styles.roleSelector}>
                    <TouchableOpacity
                      style={[
                        styles.roleOption, 
                        profile?.role === 'sender' && styles.selectedRole,
                        changingRole && styles.disabledRole
                      ]}
                      onPress={() => handleRoleChange('sender')}
                      disabled={changingRole}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="cube" size={20} color={profile?.role === 'sender' ? colors.white : colors.primary} />
                      <Text style={[styles.roleText, profile?.role === 'sender' && styles.selectedRoleText]}>
                        Sender
                      </Text>
                      {changingRole && profile?.role !== 'sender' && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.roleOption, 
                        profile?.role === 'traveler' && styles.selectedRole,
                        changingRole && styles.disabledRole
                      ]}
                      onPress={() => handleRoleChange('traveler')}
                      disabled={changingRole}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="airplane" size={20} color={profile?.role === 'traveler' ? colors.white : colors.primary} />
                      <Text style={[styles.roleText, profile?.role === 'traveler' && styles.selectedRoleText]}>
                        Traveler
                      </Text>
                      {changingRole && profile?.role !== 'traveler' && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Account Information */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Account Information</Text>
                <View style={styles.profileCard}>
                  <Ionicons name="calendar" size={22} color={colors.primary} />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardLabel}>Member Since</Text>
                    <Text style={styles.cardValue}>
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long' 
                      }) : 'Unknown'}
                    </Text>
                  </View>
                </View>
              </View>

              {isEditMode && (
                <TouchableOpacity
                  style={[styles.updateButton, loading && styles.disabledButton]}
                  onPress={handleSaveProfile}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color={colors.white} size="small" />
                      <Text style={styles.updateButtonText}>Saving...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name="save" size={20} color={colors.white} />
                      <Text style={styles.updateButtonText}>Save Changes</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Verification Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Verification</Text>
              <Text style={styles.verificationIntro}>
                Verify your account to build trust and unlock more features.
              </Text>
              
              <VerificationOption
                title="Email Address"
                subtitle="Verify your email address"
                icon="mail-outline"
                isVerified={verificationStatus.isEmailVerified}
                onPress={() => handleVerificationRequest('email')}
                progress={verificationStatus.isEmailVerified ? 100 : 0}
              />
              
              <VerificationOption
                title="Phone Number"
                subtitle="Verify your phone number"
                icon="call-outline"
                isVerified={verificationStatus.isPhoneVerified}
                onPress={() => handleVerificationRequest('phone')}
                progress={verificationStatus.isPhoneVerified ? 100 : 50}
              />
              
              <VerificationOption
                title="ID Verification"
                subtitle="Verify your identity with an ID"
                icon="card-outline"
                isVerified={verificationStatus.isIdVerified}
                onPress={() => handleVerificationRequest('id')}
                progress={verificationStatus.isIdVerified ? 100 : 0}
              />
              
              <VerificationOption
                title="Decentralized Identity"
                subtitle="Create your blockchain-based DID"
                icon="shield-checkmark-outline"
                isVerified={!!didProfile}
                onPress={handleDIDVerification}
                progress={didProfile ? 100 : 0}
              />
              
              <VerificationOption
                title="📦 Delivery Verification System"
                subtitle="Test secure package handover verification"
                icon="shield-checkmark"
                isVerified={false}
                onPress={handleHandoverTest}
                progress={0}
              />
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Header */}
        <LinearGradient
          colors={[colors.primary, '#4A90E2']}
          style={styles.compactHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.compactAvatarContainer}
              onPress={() => {
                avatarScale.value = withSequence(
                  withTiming(0.95, { duration: 100 }),
                  withTiming(1, { duration: 100 })
                );
                handleImagePick();
              }}
              disabled={uploading}
            >
              <Reanimated.View style={useAnimatedStyle(() => ({
                transform: [{ scale: avatarScale.value }],
              }))}>
                {profile?.avatar_url && !avatarError ? (
                  <Image
                    source={{ 
                      uri: profile.avatar_url + (profile.avatar_url.includes('?') ? '&' : '?') + `t=${Date.now()}&retry=${avatarRetryCount}`
                    }}
                    style={styles.compactAvatar}
                    onLoad={() => {
                      console.log('Avatar image loaded successfully for URL:', profile.avatar_url);
                      setAvatarError(false);
                      setAvatarRetryCount(0);
                    }}
                    onError={(error) => {
                      console.error('Avatar image load error:', {
                        url: profile.avatar_url,
                        error: error.nativeEvent?.error || 'Unknown error',
                        retryCount: avatarRetryCount
                      });
                      
                      if (avatarRetryCount < 3) {
                        setTimeout(() => {
                          retryAvatarLoad();
                        }, 1000 * (avatarRetryCount + 1));
                      } else {
                        setAvatarError(true);
                      }
                    }}
                  />
                ) : (
                  <View style={styles.compactAvatarPlaceholder}>
                    <Ionicons name="person" size={30} color={colors.white} />
                  </View>
                )}
                {uploading && (
                  <View style={styles.compactUploadingOverlay}>
                    <ActivityIndicator size="small" color={colors.white} />
                  </View>
                )}
                <View style={[styles.compactCameraIcon, uploading && styles.cameraIconUploading]}>
                  <Ionicons 
                    name={uploading ? "cloud-upload" : "camera"} 
                    size={12} 
                    color={colors.white} 
                  />
                </View>
              </Reanimated.View>
            </TouchableOpacity>
            
            <View style={styles.compactProfileInfo}>
              <Text style={styles.compactName}>{profile?.name || 'User'}</Text>
              <Text style={styles.compactEmail}>{session?.user?.email}</Text>
              <View style={styles.compactRoleContainer}>
                <Text style={styles.compactRoleText}>
                  {profile?.role === 'traveler' ? '✈️ Traveler' : '📦 Sender'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.trustBadgeContainer}>
            <TrustBadge level={getTrustLevel()} score={verificationStatus.trustLevel} />
          </View>
        </LinearGradient>

        {/* Inline Stats Cards */}
        <View style={styles.inlineStatsContainer}>
          <StatsCard
            title="Deliveries"
            value={profile?.completed_deliveries || 0}
            icon="cube"
            color="#32CD32"
            trend={{ value: 12, isPositive: true }}
            index={0}
          />
          <StatsCard
            title="Trust Score"
            value={`${verificationStatus.trustLevel}%`}
            icon="shield-checkmark"
            color="#007AFF"
            trend={{ value: 5, isPositive: true }}
            index={1}
          />
          <StatsCard
            title="Verifications"
            value={`${getVerificationCount()}/5`}
            icon="checkmark-circle"
            color="#FFD700"
            index={2}
          />
        </View>

        {/* Compact Tab Navigation */}
        <View style={styles.compactTabContainer}>
          {[
            { key: 'overview', title: 'Overview', icon: 'person' },
            { key: 'activity', title: 'Activity', icon: 'time' },
            { key: 'achievements', title: 'Achievements', icon: 'trophy' }
          ].map((tab, index) => {
            const isActive = activeTab === tab.key;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.compactTab, isActive && styles.activeTab]}
                onPress={() => {
                  contentOpacity.value = withSequence(
                    withTiming(0.3, { duration: 150 }),
                    withTiming(1, { duration: 150 })
                  );
                  setActiveTab(tab.key as any);
                }}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? colors.primary : colors.text.secondary} 
                />
                <Text style={[
                  styles.compactTabText, 
                  isActive && styles.activeTabText
                ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <Reanimated.View style={useAnimatedStyle(() => ({
          opacity: contentOpacity.value,
        }))}>
          {renderTabContent()}

          {/* Sign Out Button */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.signOutButton} 
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 50 }} />
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  compactHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  compactAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: spacing.md,
    position: 'relative',
  },
  compactAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.white,
  },
  compactAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  compactUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCameraIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  cameraIconUploading: {
    backgroundColor: colors.secondary,
  },
  compactProfileInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  compactName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  compactEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs,
  },
  compactRoleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  compactRoleText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '500',
  },
  trustBadgeContainer: {
    marginTop: spacing.sm,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trustBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    marginRight: 4,
  },
  trustScore: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  inlineStatsContainer: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: 0,
    marginBottom: spacing.md,
  },
  statsCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: 4,
    ...shadows.small,
    elevation: 3,
  },
  statsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statsTitle: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  compactTabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: 0,
    borderRadius: borderRadius.md,
    padding: 2,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  compactTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: '#F0F8FF',
  },
  compactTabText: {
    fontSize: 11,
    color: colors.text.secondary,
    marginLeft: 3,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  inputContainer: {
    marginBottom: spacing.sm,
  },
  compactInputContainer: {
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.small,
  },
  disabledButton: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  verificationIntro: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  verificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: '#F8F9FA',
  },
  verifiedOption: {
    backgroundColor: '#F0FFF0',
    borderWidth: 1,
    borderColor: '#32CD32',
  },
  verificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verifiedIconContainer: {
    backgroundColor: '#32CD32',
  },
  verificationText: {
    flex: 1,
  },
  verificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
  },
  verifiedText: {
    color: '#32CD32',
    fontWeight: '600',
  },
  notVerifiedText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  activityDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  activityDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementBadge: {
    width: (SCREEN_WIDTH - 80) / 2,
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  lockedAchievement: {
    opacity: 0.6,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  lockedText: {
    color: colors.text.secondary,
  },
  achievementProgress: {
    width: '100%',
    marginTop: spacing.sm,
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 4,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  achievementProgressText: {
    fontSize: 10,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  signOutText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: 0,
    ...shadows.small,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  bioCard: {
    alignItems: 'flex-start',
    minHeight: 60,
  },
  bioText: {
    flex: 1,
    marginLeft: spacing.sm,
    lineHeight: 22,
  },
  roleBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  roleBadgeText: {
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  statusText: {
    fontSize: 12,
    color: colors.text.primary,
  },
  unverifiedBadge: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  unverifiedText: {
    color: colors.primary,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  cancelButtonText: {
    color: '#FF3B30',
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  selectedRole: {
    backgroundColor: colors.primary,
  },
  selectedRoleText: {
    color: colors.white,
  },
  roleText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  comingSoonText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledRole: {
    opacity: 0.6,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
}); 