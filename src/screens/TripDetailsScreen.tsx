import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, TabParamList } from '../navigation/types';
import { Trip } from '../types/models';

type TripDetailsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'TripDetails'>,
  BottomTabNavigationProp<TabParamList>
>;

type TripDetailsScreenRouteProp = RouteProp<HomeStackParamList, 'TripDetails'>;

const TripDetailsScreen = () => {
  const navigation = useNavigation<TripDetailsScreenNavigationProp>();
  const route = useRoute<TripDetailsScreenRouteProp>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTripDetails = async () => {
      try {
        const { data, error } = await supabase
          .from('trips')
          .select(`
            *,
            profiles (
              id,
              name,
              avatar_url
            )
          `)
          .eq('id', route.params.tripId)
          .single();

        if (error) throw error;
        console.log('Trip data:', data);
        console.log('Profiles data:', data.profiles);
        
        // Map the profiles data to the user property
        const tripData = {
          ...data,
          user: data.profiles
        };
        console.log('Mapped trip data:', tripData);
        setTrip(tripData);
      } catch (error) {
        console.error('Error fetching trip details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTripDetails();
  }, [route.params.tripId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
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
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{trip.user?.name || 'Anonymous Traveler'}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.rating}>New</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.routeContainer}>
          <View style={styles.locations}>
            <Text style={styles.location}>{trip.origin}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.text.primary} />
            <Text style={styles.location}>{trip.destination}</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Departure Date</Text>
              <Text style={styles.detailValue}>
                {format(new Date(trip.departure_date), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <Ionicons name="time" size={24} color={colors.primary} />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Time Until Departure</Text>
              <Text style={styles.detailValue}>
                {formatDistanceToNow(new Date(trip.departure_date), { addSuffix: true })}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => navigation.navigate('Messages', { 
            screen: 'Chat', 
            params: {
              otherUserId: trip.user_id.toString(),
              otherUserName: trip.user?.name || 'Anonymous Traveler'
            }
          })}
        >
          <Text style={styles.contactButtonText}>Contact Traveler</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
  },
  header: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    ...shadows.medium,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: spacing.md,
  },
  userName: {
    fontSize: typography.sizes.lg,
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
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  routeContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  locations: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  location: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginHorizontal: spacing.sm,
  },
  detailsContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailTextContainer: {
    marginLeft: spacing.md,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: '500',
  },
  contactButton: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  contactButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
});

export default TripDetailsScreen; 