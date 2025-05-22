import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeInUp
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';

type Traveler = {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string | null;
  capacity: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'completed';
  profile: {
    name: string;
    avatar_url: string | null;
  };
};

type CapacityOption = 'small' | 'medium' | 'large';

type FindTravelersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FindTravelers'>;

const CAPACITY_OPTIONS: { value: CapacityOption; label: string; icon: string; weightRange: string }[] = [
  { value: 'small', label: 'Small', icon: 'cube-outline', weightRange: '1-5 kg' },
  { value: 'medium', label: 'Medium', icon: 'cube', weightRange: '5-15 kg' },
  { value: 'large', label: 'Large', icon: 'cube-sharp', weightRange: '15-30 kg' },
];

const AnimatedText = Animated.createAnimatedComponent(Text);

export const FindTravelersScreen = () => {
  const { profile } = useAuth();
  const navigation = useNavigation<FindTravelersScreenNavigationProp>();
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState('');
  const [origin, setOrigin] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedCapacity, setSelectedCapacity] = useState<CapacityOption | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTravelers();
  }, []);

  const fetchTravelers = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          profile:profiles(name, avatar_url)
        `)
        .eq('status', 'pending')
        .order('departure_date', { ascending: true });

      if (error) throw error;
      setTravelers(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      let query = supabase
        .from('trips')
        .select(`
          *,
          profile:profiles(name, avatar_url)
        `)
        .eq('status', 'pending');

      if (destination) {
        query = query.ilike('destination', `%${destination}%`);
      }
      if (origin) {
        query = query.ilike('origin', `%${origin}%`);
      }
      if (selectedCapacity) {
        query = query.eq('capacity', selectedCapacity);
      }
      if (startDate) {
        query = query.gte('departure_date', startDate);
      }
      if (endDate) {
        query = query.lte('departure_date', endDate);
      }

      const { data, error } = await query.order('departure_date', { ascending: true });

      if (error) throw error;
      setTravelers(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSearching(false);
    }
  };

  const validateDates = () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      Alert.alert('Invalid Dates', 'Start date must be before end date');
      return false;
    }
    return true;
  };

  const handleSearchPress = () => {
    if (!validateDates()) return;
    handleSearch();
  };

  const clearFilters = () => {
    setDestination('');
    setOrigin('');
    setSelectedCapacity(null);
    setStartDate('');
    setEndDate('');
    fetchTravelers();
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const handleContactTraveler = async (traveler: Traveler) => {
    if (!profile) {
      Alert.alert('Error', 'Please log in to contact travelers');
      return;
    }

    try {
      const { data: existingMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .or(`sender_id.eq.${traveler.user_id},receiver_id.eq.${traveler.user_id}`)
        .limit(1);

      if (messagesError) throw messagesError;

      navigation.navigate('Chat', {
        otherUserId: traveler.user_id,
        otherUserName: traveler.profile.name,
        otherUserAvatar: traveler.profile.avatar_url,
        tripId: traveler.id
      });

      if (!existingMessages || existingMessages.length === 0) {
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            sender_id: profile.id,
            receiver_id: traveler.user_id,
            content: `Hi! I'm interested in your trip from ${traveler.origin} to ${traveler.destination}.`,
            trip_id: traveler.id
          });

        if (messageError) throw messageError;
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
      console.error('Contact traveler error:', error);
    }
  };

  const renderTraveler = ({ item, index }: { item: Traveler; index: number }) => (
    <Animated.View 
      entering={FadeInUp.delay(index * 100).springify()}
      style={styles.travelerCard}
    >
      <View style={styles.travelerHeader}>
        <View style={styles.locationContainer}>
          <Text style={styles.location}>{item.origin}</Text>
          <Ionicons name="airplane" size={16} color={colors.primary} style={styles.arrowIcon} />
          <Text style={styles.location}>{item.destination}</Text>
        </View>
      </View>

      <View style={styles.travelerDetails}>
        <View style={styles.travelerInfo}>
          <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.travelerName}>{item.profile.name}</Text>
        </View>
        
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
          <Text style={styles.dateText}>{formatDate(item.departure_date)}</Text>
        </View>
        
        {item.return_date && (
          <View style={styles.dateContainer}>
            <Ionicons name="return-down-back-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.dateText}>{formatDate(item.return_date)}</Text>
          </View>
        )}
        
        <View style={styles.capacityContainer}>
          <Ionicons name={CAPACITY_OPTIONS.find(opt => opt.value === item.capacity)?.icon as any} 
            size={16} 
            color={colors.primary} 
          />
          <Text style={styles.capacityText}>
            {item.capacity.charAt(0).toUpperCase() + item.capacity.slice(1)} 
            ({CAPACITY_OPTIONS.find(opt => opt.value === item.capacity)?.weightRange})
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.contactButton}
        onPress={() => handleContactTraveler(item)}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.white} />
        <Text style={styles.contactButtonText}>Contact Traveler</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.searchContainer}>
        <AnimatedText 
          entering={FadeInUp.delay(200).springify()}
          style={styles.title}
        >
          Find Travelers
        </AnimatedText>

        <Animated.View 
          entering={FadeInUp.delay(300).springify()}
          style={styles.searchInputs}
        >
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="From (City)"
              value={origin}
              onChangeText={setOrigin}
              placeholderTextColor={colors.text.secondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="location" size={20} color={colors.text.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="To (City)"
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor={colors.text.secondary}
            />
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(400).springify()}
          style={styles.filterSection}
        >
          <TouchableOpacity 
            style={styles.filterToggle}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons 
              name={showFilters ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={colors.primary} 
            />
            <Text style={styles.filterToggleText}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Text>
          </TouchableOpacity>

          {showFilters && (
            <Animated.View 
              entering={FadeInUp.delay(500).springify()}
              style={styles.filtersContainer}
            >
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.dateInputs}>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholderTextColor={colors.text.secondary}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Ionicons name="calendar" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="End Date (YYYY-MM-DD)"
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholderTextColor={colors.text.secondary}
                  />
                </View>
              </View>

              <Text style={styles.filterLabel}>Required Capacity</Text>
              <View style={styles.capacityButtons}>
                {CAPACITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.capacityButton,
                      selectedCapacity === option.value && styles.capacityButtonSelected
                    ]}
                    onPress={() => setSelectedCapacity(
                      selectedCapacity === option.value ? null : option.value
                    )}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={24}
                      color={selectedCapacity === option.value ? colors.white : colors.primary}
                    />
                    <Text style={[
                      styles.capacityButtonText,
                      selectedCapacity === option.value && styles.capacityButtonTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.capacityWeightText,
                      selectedCapacity === option.value && styles.capacityWeightTextSelected
                    ]}>
                      {option.weightRange}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Ionicons name="trash-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.clearButtonText}>Clear All Filters</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(600).springify()}
          style={styles.searchButtonContainer}
        >
          <TouchableOpacity 
            style={[styles.searchButton, searching && styles.searchButtonDisabled]}
            onPress={handleSearchPress}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="search" size={20} color={colors.white} />
                <Text style={styles.searchButtonText}>Search</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : travelers.length === 0 ? (
        <Animated.View 
          entering={FadeInUp.delay(700).springify()}
          style={styles.emptyState}
        >
          <Ionicons name="airplane-outline" size={48} color={colors.text.secondary} />
          <Text style={styles.emptyStateText}>
            No travelers found matching your criteria.
          </Text>
          <Text style={styles.emptyStateSubText}>
            Try adjusting your search or check back later.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={travelers}
          renderItem={renderTraveler}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  searchContainer: {
    padding: spacing.lg,
  },
  searchInputs: {
    gap: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  filterSection: {
    marginTop: spacing.lg,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  filterToggleText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  filtersContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  filterLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dateInputs: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  capacityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  capacityButton: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  capacityButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  capacityButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  capacityButtonTextSelected: {
    color: colors.white,
  },
  capacityWeightText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  capacityWeightTextSelected: {
    color: colors.white,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  clearButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  searchButtonContainer: {
    marginTop: spacing.lg,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.medium,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyStateSubText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  listContainer: {
    padding: spacing.lg,
  },
  travelerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  travelerHeader: {
    marginBottom: spacing.md,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  location: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  arrowIcon: {
    marginHorizontal: spacing.xs,
  },
  travelerDetails: {
    gap: spacing.sm,
  },
  travelerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  travelerName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  capacityText: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
  },
  contactButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadows.small,
  },
  contactButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
  },
}); 