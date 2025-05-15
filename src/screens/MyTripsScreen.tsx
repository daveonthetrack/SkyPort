import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, shadows, spacing, borderRadius } from '../theme';
import { RootStackParamList } from '../navigation';
import TripTimeline from '../components/TripTimeline';
import { format, differenceInDays, isBefore } from 'date-fns';

type Trip = {
  id: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  capacity: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'completed';
  created_at: string;
  is_verified?: boolean;
  verification_method?: string;
  verification_image_url?: string;
  pickup_date?: string;
  delivery_date?: string;
  estimated_delivery_date?: string;
  trip_type?: 'one-way' | 'round-trip';
};

type FilterType = 'all' | 'upcoming' | 'active' | 'completed' | 'verified';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MyTrips'>;

export const MyTripsScreen = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    applyFilter(activeFilter);
  }, [trips, activeFilter]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', profile?.id)
        .order('departure_date', { ascending: true });

      if (error) throw error;
      setTrips(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (filter: FilterType) => {
    const now = new Date();
    
    switch (filter) {
      case 'upcoming':
        setFilteredTrips(trips.filter(trip => {
          const departureDate = new Date(trip.departure_date);
          return isBefore(now, departureDate) && trip.status === 'pending';
        }));
        break;
      case 'active':
        setFilteredTrips(trips.filter(trip => trip.status === 'accepted'));
        break;
      case 'completed':
        setFilteredTrips(trips.filter(trip => trip.status === 'completed'));
        break;
      case 'verified':
        setFilteredTrips(trips.filter(trip => trip.is_verified));
        break;
      default:
        setFilteredTrips(trips);
        break;
    }
  };

  const handleVerifyTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setVerificationModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#32CD32';
      case 'completed':
        return '#4169E1';
      default:
        return '#000';
    }
  };

  const getCapacityIcon = (capacity: string) => {
    switch (capacity) {
      case 'small':
        return 'briefcase-outline';
      case 'medium':
        return 'briefcase';
      case 'large':
        return 'briefcase-sharp';
      default:
        return 'briefcase-outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilTrip = (dateString: string) => {
    const departureDate = new Date(dateString);
    const now = new Date();
    const days = differenceInDays(departureDate, now);
    
    if (days < 0) {
      return 'Past';
    } else if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Tomorrow';
    } else {
      return `${days} days`;
    }
  };

  const handleNavigateToFindItems = (trip: Trip) => {
    // Navigate to find items that match this trip
    navigation.navigate('FindItems', { 
      origin: trip.origin,
      destination: trip.destination,
      tripId: trip.id
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const handleVerificationComplete = async () => {
    if (!selectedTrip) return;
    
    try {
      // Update the trip to be verified
      const { error } = await supabase
        .from('trips')
        .update({
          is_verified: true,
          verification_method: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTrip.id);
        
      if (error) throw error;
      
      // Close modal and refresh trips
      setVerificationModalVisible(false);
      setSelectedTrip(null);
      fetchTrips();
      
      Alert.alert('Success', 'Trip verified successfully!');
    } catch (error: any) {
      console.error('Error verifying trip:', error);
      Alert.alert('Error', error.message || 'Failed to verify trip');
    }
  };

  const renderItem = ({ item }: { item: Trip }) => {
    const departureDate = new Date(item.departure_date);
    const isUpcoming = departureDate > new Date();
    
    return (
      <View style={styles.tripCard}>
        {/* Status indicator */}
        <View style={[
          styles.statusIndicator, 
          { backgroundColor: getStatusColor(item.status) }
        ]} />
        
        <View style={styles.tripHeader}>
          <View style={styles.tripTypeContainer}>
            <Ionicons 
              name={item.trip_type === 'round-trip' ? 'repeat' : 'arrow-forward'} 
              size={16} 
              color={colors.text.secondary} 
            />
            <Text style={styles.tripTypeText}>
              {item.trip_type === 'round-trip' ? 'Round Trip' : 'One Way'}
            </Text>
          </View>
          
          <View style={styles.badgeContainer}>
            {item.is_verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={styles.originDot} />
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.locationText}>{item.origin}</Text>
              <Text style={styles.dateInline}>{formatDate(item.departure_date)}</Text>
            </View>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routePoint}>
            <View style={styles.destinationDot} />
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.locationText}>{item.destination}</Text>
              {item.return_date ? (
                <Text style={styles.dateInline}>{formatDate(item.return_date)}</Text>
              ) : (
                <Text style={styles.dateInline}>No return</Text>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.tripInfoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name={getCapacityIcon(item.capacity)} size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {item.capacity.charAt(0).toUpperCase() + item.capacity.slice(1)}
            </Text>
          </View>
          
          {isUpcoming && (
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{getDaysUntilTrip(item.departure_date)}</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {!item.is_verified && (
            <TouchableOpacity 
              style={styles.verifyButton}
              onPress={() => handleVerifyTrip(item)}
            >
              <Ionicons name="shield-outline" size={18} color="#fff" />
              <Text style={styles.verifyButtonText}>Verify</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.viewItemsButton}
            onPress={() => handleNavigateToFindItems(item)}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.viewItemsButtonText}>Find Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('PostTrip')}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Text style={styles.addButtonText}>New Trip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === 'all' && styles.filterButtonTextActive
            ]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'upcoming' && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter('upcoming')}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === 'upcoming' && styles.filterButtonTextActive
            ]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'active' && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter('active')}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === 'active' && styles.filterButtonTextActive
            ]}>
              Active
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'completed' && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter('completed')}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === 'completed' && styles.filterButtonTextActive
            ]}>
              Completed
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'verified' && styles.filterButtonActive
            ]}
            onPress={() => setActiveFilter('verified')}
          >
            <Text style={[
              styles.filterButtonText,
              activeFilter === 'verified' && styles.filterButtonTextActive
            ]}>
              Verified
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading trips...</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="airplane-outline" size={80} color={colors.text.secondary} />
          <Text style={styles.emptyStateTitle}>
            {activeFilter === 'all' ? 'No Trips Yet' : `No ${activeFilter} Trips`}
          </Text>
          <Text style={styles.emptyStateText}>
            {activeFilter === 'all' 
              ? 'Add your upcoming travel plans to find items you can deliver.'
              : `You don't have any ${activeFilter} trips at the moment.`}
          </Text>
          <TouchableOpacity 
            style={styles.postButton}
            onPress={() => navigation.navigate('PostTrip')}
          >
            <Text style={styles.postButtonText}>Post a New Trip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}

      <Modal
        visible={verificationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Trip</Text>
            <Text style={styles.modalText}>
              Verifying your trip helps build trust with senders and increases your chances of getting delivery requests.
            </Text>
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setVerificationModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.verifyConfirmButton]}
                onPress={handleVerificationComplete}
              >
                <Text style={styles.verifyConfirmButtonText}>Verify Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 10,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
  },
  listContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  tripCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
    position: 'relative',
    overflow: 'hidden',
  },
  statusIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tripTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripTypeText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    marginTop: 4,
    marginRight: spacing.sm,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
    marginRight: spacing.sm,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
    marginVertical: 2,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateInline: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  tripInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  verifyButton: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: spacing.md,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  viewItemsButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  viewItemsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 3,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  filterScrollContent: {
    paddingRight: spacing.md,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  postButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  postButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    ...shadows.medium,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    color: colors.text.primary,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  verifyConfirmButton: {
    backgroundColor: colors.primary,
  },
  verifyConfirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
}); 