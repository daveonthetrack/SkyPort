import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { differenceInDays, format, isBefore } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing } from '../theme';

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
  user_id?: string;
  updated_at?: string;
};

type FilterType = 'all' | 'upcoming' | 'active' | 'completed' | 'verified';
type SortType = 'date' | 'status' | 'destination';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MyTrips'>;

export const MyTripsScreen = () => {
  const { profile } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('upcoming');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  // Enhanced filter counts for better UX
  const getFilterCounts = () => {
    const now = new Date();
    const counts = {
      all: trips.length,
      upcoming: trips.filter(trip => {
        const departureDate = new Date(trip.departure_date);
        return isBefore(now, departureDate) && trip.status === 'pending';
      }).length,
      active: trips.filter(trip => trip.status === 'accepted').length,
      completed: trips.filter(trip => trip.status === 'completed').length,
      verified: trips.filter(trip => trip.is_verified).length,
    };
    return counts;
  };

  const filterCounts = getFilterCounts();

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    applyFilterAndSort();
  }, [trips, activeFilter, sortBy]);

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

  const applyFilterAndSort = () => {
    let filtered = [...trips];
    const now = new Date();
    
    // Enhanced filter logic with better conditions
    switch (activeFilter) {
      case 'upcoming':
        filtered = filtered.filter(trip => {
          const departureDate = new Date(trip.departure_date);
          return isBefore(now, departureDate) && trip.status === 'pending';
        });
        break;
      case 'active':
        filtered = filtered.filter(trip => trip.status === 'accepted');
        break;
      case 'completed':
        filtered = filtered.filter(trip => trip.status === 'completed');
        break;
      case 'verified':
        filtered = filtered.filter(trip => trip.is_verified);
        break;
      default:
        // 'all' - no filtering
        break;
    }
    
    // Enhanced sorting logic
    switch (sortBy) {
      case 'date':
        filtered.sort((a, b) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime());
        break;
      case 'status':
        const statusOrder = { 'pending': 0, 'accepted': 1, 'completed': 2 };
        filtered.sort((a, b) => {
          const statusA = a.status || 'pending';
          const statusB = b.status || 'pending';
          return statusOrder[statusA as keyof typeof statusOrder] - statusOrder[statusB as keyof typeof statusOrder];
        });
        break;
      case 'destination':
        filtered.sort((a, b) => a.destination.localeCompare(b.destination));
        break;
    }
    
    setFilteredTrips(filtered);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  const handleVerifyTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    setVerificationModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'accepted':
        return '#34C759';
      case 'completed':
        return '#007AFF';
      default:
        return '#8E8E93';
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
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
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
    navigation.navigate('FindItems', { 
      origin: trip.origin,
      destination: trip.destination,
      tripId: parseInt(trip.id)
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const handleVerificationComplete = async () => {
    if (!selectedTrip) return;
    
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          is_verified: true,
          verification_method: 'manual',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTrip.id);
        
      if (error) throw error;
      
      setVerificationModalVisible(false);
      setSelectedTrip(null);
      fetchTrips();
      
      Alert.alert('Success', 'Trip verified successfully!');
    } catch (error: any) {
      console.error('Error verifying trip:', error);
      Alert.alert('Error', error.message || 'Failed to verify trip');
    }
  };
    
    return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>My Trips</Text>
            <Text style={styles.subtitle}>
              {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
              {activeFilter !== 'all' && ` • ${activeFilter}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.sortButton}
              onPress={() => setSortModalVisible(true)}
            >
              <Ionicons name="funnel-outline" size={20} color={colors.white} />
            </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('PostTrip')}
        >
              <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
        </View>
      </LinearGradient>

      {/* Enhanced Filter Section */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'all' && styles.filterButtonActive,
              { backgroundColor: activeFilter === 'all' ? colors.primary : colors.white }
            ]}
            onPress={() => handleFilterChange('all')}
          >
            <Ionicons 
              name="layers-outline" 
              size={12} 
              color={activeFilter === 'all' ? colors.white : colors.text.primary} 
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === 'all' ? colors.white : colors.text.primary }
            ]}>
              All
            </Text>
            {filterCounts.all > 0 && (
              <View style={[
                styles.filterBadge,
                { backgroundColor: activeFilter === 'all' ? 'rgba(255,255,255,0.3)' : colors.primary }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === 'all' ? colors.white : colors.white }
                ]}>{filterCounts.all}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'upcoming' && styles.filterButtonActive,
              { backgroundColor: activeFilter === 'upcoming' ? colors.primary : colors.white }
            ]}
            onPress={() => handleFilterChange('upcoming')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={12} 
              color={activeFilter === 'upcoming' ? colors.white : '#FF9500'} 
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === 'upcoming' ? colors.white : colors.text.primary }
            ]}>
              Coming
            </Text>
            {filterCounts.upcoming > 0 && (
              <View style={[
                styles.filterBadge,
                { backgroundColor: activeFilter === 'upcoming' ? 'rgba(255,255,255,0.3)' : '#FF9500' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === 'upcoming' ? colors.white : colors.white }
                ]}>{filterCounts.upcoming}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'active' && styles.filterButtonActive,
              { backgroundColor: activeFilter === 'active' ? colors.primary : colors.white }
            ]}
            onPress={() => handleFilterChange('active')}
          >
            <Ionicons 
              name="play-circle-outline" 
              size={12} 
              color={activeFilter === 'active' ? colors.white : '#34C759'} 
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === 'active' ? colors.white : colors.text.primary }
            ]}>
              Active
            </Text>
            {filterCounts.active > 0 && (
              <View style={[
                styles.filterBadge,
                { backgroundColor: activeFilter === 'active' ? 'rgba(255,255,255,0.3)' : '#34C759' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === 'active' ? colors.white : colors.white }
                ]}>{filterCounts.active}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'completed' && styles.filterButtonActive,
              { backgroundColor: activeFilter === 'completed' ? colors.primary : colors.white }
            ]}
            onPress={() => handleFilterChange('completed')}
          >
            <Ionicons 
              name="checkmark-circle-outline" 
              size={12} 
              color={activeFilter === 'completed' ? colors.white : '#007AFF'} 
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === 'completed' ? colors.white : colors.text.primary }
            ]}>
              Done
            </Text>
            {filterCounts.completed > 0 && (
              <View style={[
                styles.filterBadge,
                { backgroundColor: activeFilter === 'completed' ? 'rgba(255,255,255,0.3)' : '#007AFF' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === 'completed' ? colors.white : colors.white }
                ]}>{filterCounts.completed}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilter === 'verified' && styles.filterButtonActive,
              { backgroundColor: activeFilter === 'verified' ? colors.primary : colors.white }
            ]}
            onPress={() => handleFilterChange('verified')}
          >
            <Ionicons 
              name="shield-checkmark-outline" 
              size={12} 
              color={activeFilter === 'verified' ? colors.white : '#34C759'} 
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFilter === 'verified' ? colors.white : colors.text.primary }
            ]}>
              Verified
            </Text>
            {filterCounts.verified > 0 && (
              <View style={[
                styles.filterBadge,
                { backgroundColor: activeFilter === 'verified' ? 'rgba(255,255,255,0.3)' : '#34C759' }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: activeFilter === 'verified' ? colors.white : colors.white }
                ]}>{filterCounts.verified}</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Loading trips...</Text>
        </View>
      ) : filteredTrips.length === 0 ? (
        <View style={styles.emptyStateWrapper}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="airplane-outline" size={64} color={colors.text.secondary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text.primary }]}>
            {activeFilter === 'all' ? 'No Trips Yet' : 
             activeFilter === 'upcoming' ? 'No Coming Trips' :
             activeFilter === 'completed' ? 'No Done Trips' :
             `No ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Trips`}
          </Text>
          <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
            {activeFilter === 'all' 
              ? 'Ready to earn while you travel? Post your first trip to get started.'
              : activeFilter === 'upcoming' 
                ? `You don't have any upcoming trips right now.`
                : activeFilter === 'completed'
                  ? `You don't have any completed trips yet.`
              : `You don't have any ${activeFilter} trips at the moment.`}
          </Text>
          <TouchableOpacity 
            style={styles.postButton}
            onPress={() => navigation.navigate('PostTrip')}
          >
            <Ionicons name="add" size={20} color={colors.white} style={{ marginRight: spacing.sm }} />
            <Text style={styles.postButtonText}>Post a New Trip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          renderItem={({ item, index }) => (
            <Animated.View style={styles.animationWrapper}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Trip Details', `View details for trip from ${item.origin} to ${item.destination}`);
                }}
                activeOpacity={0.95}
                style={styles.cardTouchable}
              >
                <View style={[styles.tripCard, { backgroundColor: colors.white }]}>
                  {/* Enhanced status indicator */}
                  <LinearGradient
                    colors={[getStatusColor(item.status || 'pending'), getStatusColor(item.status || 'pending') + '80']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.statusIndicator}
                  />
                  
                  {/* Optimized header */}
                  <View style={styles.tripHeader}>
                    <View style={styles.tripTypeContainer}>
                      <View style={[styles.tripTypeIconContainer, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons 
                          name={item.trip_type === 'round-trip' ? 'repeat' : 'arrow-forward'} 
                          size={14} 
                          color={colors.primary} 
                        />
                      </View>
                      <Text style={[styles.tripTypeText, { color: colors.text.secondary }]}>
                        {item.trip_type === 'round-trip' ? 'Round Trip' : 'One Way'}
                      </Text>
                    </View>
                    
                    <View style={styles.badgeContainer}>
                      {item.is_verified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={12} color="#fff" />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'pending') }]}>
                        <Text style={styles.statusText}>
                          {(item.status || 'pending').charAt(0).toUpperCase() + (item.status || 'pending').slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Enhanced route section */}
                  <View style={styles.routeContainer}>
                    <View style={styles.routePoint}>
                      <View style={styles.originDot} />
                      <View style={styles.routeDetails}>
                        <Text style={[styles.routeLabel, { color: colors.text.secondary }]}>FROM</Text>
                        <Text style={[styles.locationText, { color: colors.text.primary }]} numberOfLines={1}>
                          {item.origin}
                        </Text>
                        <View style={styles.dateTimeContainer}>
                          <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
                          <Text style={[styles.dateText, { color: colors.text.secondary }]}>
                            {formatDate(item.departure_date)}
                          </Text>
                          <Ionicons name="time-outline" size={12} color={colors.text.secondary} style={{ marginLeft: 8 }} />
                          <Text style={[styles.timeText, { color: colors.text.secondary }]}>
                            {formatTime(item.departure_date)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.routeLineContainer}>
                      <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
                      <Ionicons name="airplane" size={14} color={colors.primary} style={styles.airplaneIcon} />
                    </View>
                    
                    <View style={styles.routePoint}>
                      <View style={styles.destinationDot} />
                      <View style={styles.routeDetails}>
                        <Text style={[styles.routeLabel, { color: colors.text.secondary }]}>TO</Text>
                        <Text style={[styles.locationText, { color: colors.text.primary }]} numberOfLines={1}>
                          {item.destination}
                        </Text>
                        {item.return_date ? (
                          <View style={styles.dateTimeContainer}>
                            <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
                            <Text style={[styles.dateText, { color: colors.text.secondary }]}>
                              {formatDate(item.return_date)}
                            </Text>
                            <Ionicons name="time-outline" size={12} color={colors.text.secondary} style={{ marginLeft: 8 }} />
                            <Text style={[styles.timeText, { color: colors.text.secondary }]}>
                              {formatTime(item.return_date)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.noReturnText, { color: colors.text.secondary }]}>
                            No return date
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  {/* Optimized info section */}
                  <View style={[styles.tripInfoContainer, { borderTopColor: colors.border }]}>
                    <View style={styles.infoItem}>
                      <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name={getCapacityIcon(item.capacity)} size={16} color={colors.primary} />
                      </View>
                      <Text style={[styles.infoText, { color: colors.text.primary }]}>
                        {item.capacity.charAt(0).toUpperCase() + item.capacity.slice(1)}
                      </Text>
                    </View>
                    
                    {new Date(item.departure_date) > new Date() && (
                      <View style={styles.infoItem}>
                        <View style={[styles.infoIconContainer, { backgroundColor: '#FF9500' + '15' }]}>
                          <Ionicons name="time-outline" size={16} color="#FF9500" />
                        </View>
                        <Text style={[styles.infoText, { color: colors.text.primary }]}>
                          {getDaysUntilTrip(item.departure_date)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Enhanced action buttons */}
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleNavigateToFindItems(item)}
                    >
                      <Ionicons name="search" size={16} color="#fff" />
                      <Text style={styles.primaryButtonText}>Find Items</Text>
                    </TouchableOpacity>

                    {!item.is_verified && new Date(item.departure_date) > new Date() && (
                      <TouchableOpacity 
                        style={[styles.secondaryButton, { borderColor: colors.secondary }]}
                        onPress={() => handleVerifyTrip(item)}
                      >
                        <Ionicons name="shield-outline" size={16} color={colors.secondary} />
                        <Text style={[styles.secondaryButtonText, { color: colors.secondary }]}>Verify</Text>
                      </TouchableOpacity>
                    )}

                    {new Date(item.departure_date) > new Date() && (
                      <TouchableOpacity 
                        style={[styles.iconButton, { backgroundColor: colors.white, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('PostTrip', { 
                          editTrip: { 
                            ...item, 
                            user_id: item.user_id || profile?.id || '',
                            updated_at: item.updated_at || new Date().toISOString()
                          } 
                        })}
                      >
                        <Ionicons name="pencil" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
  },
  header: {
    paddingTop: spacing.xl + 10,
    paddingBottom: spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.white + 'CC',
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  addButton: {
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  listContainer: {
    padding: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tripCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.medium,
    elevation: 4,
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
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  tripTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
  },
  tripTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.xs,
    textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeContainer: {
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    marginTop: 3,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: '#34C759' + '30',
  },
  destinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 3,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  routeLine: {
    position: 'absolute',
    left: 4,
    top: 13,
    bottom: -spacing.sm,
    width: 2,
    backgroundColor: '#E5E5EA',
  },
  routeDetails: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 1,
    textAlign: 'left',
  },
  locationText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 1,
    letterSpacing: -0.2,
    textAlign: 'left',
    lineHeight: 18,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  dateText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
    marginLeft: 2,
    textAlign: 'left',
  },
  timeText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
    marginLeft: 6,
    textAlign: 'left',
  },
  noReturnText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
    marginTop: 1,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  routeLineContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  airplaneIcon: {
    position: 'absolute',
    left: -2,
    top: '50%',
    transform: [{ translateY: -7 }],
  },
  tripInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  infoIconContainer: {
    padding: 2,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  infoText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    flex: 1,
    ...shadows.small,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
    marginLeft: spacing.xs,
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 11,
    marginLeft: spacing.xs,
    textAlign: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  filterScrollContent: {
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadows.small,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  filterButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 3,
  },
  emptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    padding: spacing.lg,
    borderRadius: 50,
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: 260,
    fontWeight: '500',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  verifyConfirmButton: {
    backgroundColor: colors.primary,
  },
  verifyConfirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  sortModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '60%',
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.lg,
  },
  closeButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sortOptions: {
    gap: spacing.xs,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderRadius: borderRadius.md,
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  animationWrapper: {
    width: '100%',
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: 'transparent',
  },
  filterBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 4,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  cardTouchable: {
    flex: 1,
  },
  tripTypeIconContainer: {
    padding: 4,
    borderRadius: 12,
    marginRight: spacing.xs,
  },
  tripTypeIcon: {
    width: 20,
    height: 20,
  },
  statusBadge: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 2,
    textAlign: 'center',
  },
  postButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl * 1.5,
    width: '100%',
    alignItems: 'center',
    ...shadows.medium,
  },
  postButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxHeight: '50%',
    ...shadows.large,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.lg,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
}); 