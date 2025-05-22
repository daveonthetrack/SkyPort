import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { subDays, subMonths } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HomeStackParamList, TabParamList } from '../navigation/types';
import { colors } from '../theme';

const { width } = Dimensions.get('window');
const numColumns = 2;
const cardWidth = (width - 48) / numColumns;

type ItemStatus = 'pending' | 'accepted' | 'delivered' | 'cancelled';

interface Item {
  id: number;
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  size: string;
  status: ItemStatus;
  created_at: string;
  image_url?: string;
  user_id: number;
  accepted_by?: number;
  pickup_date?: string;
  estimated_delivery_date?: string;
  sender: {
    id: number;
    name: string;
    avatar_url?: string;
  };
}

type FindItemsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'FindItems'>,
  BottomTabNavigationProp<TabParamList>
>;

const PickupButton = ({ 
  itemId, 
  status, 
  onConfirm,
  item
}: { 
  itemId: string; 
  status: string; 
  onConfirm: (id: string, item: Item) => void;
  item: Item;
}) => {
  const progress = useSharedValue(0);
  const isAccepted = status === 'accepted';

  useEffect(() => {
    progress.value = withSpring(isAccepted ? 1 : 0);
  }, [isAccepted]);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#007AFF', '#28A745']
    );

    return {
      backgroundColor,
      transform: [{ scale: withSpring(progress.value === 1 ? 1 : 1) }],
    };
  });

  return (
    <Animated.View style={[styles.pickupButton, animatedStyle]}>
      <TouchableOpacity
        onPress={() => onConfirm(itemId, item)}
        disabled={isAccepted}
        style={styles.pickupButtonContent}
      >
        <Ionicons 
          name={isAccepted ? "checkmark-circle" : "checkmark-circle-outline"} 
          size={20} 
          color="#fff" 
        />
        <Text style={styles.pickupButtonText}>
          {isAccepted ? 'Accepted' : 'Pick Up'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Add this new component for the filter modal
const FilterModal = ({ 
  visible, 
  onClose, 
  filters, 
  onApplyFilters,
}: { 
  visible: boolean, 
  onClose: () => void, 
  filters: {
    status: string[],
    size: string[],
    date: string,
    location: string
  }, 
  onApplyFilters: (filters: any) => void,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);
  
  const toggleStatus = (status: string) => {
    setLocalFilters(prev => {
      if (prev.status.includes(status)) {
        return {...prev, status: prev.status.filter(s => s !== status)};
      } else {
        return {...prev, status: [...prev.status, status]};
      }
    });
  };
  
  const toggleSize = (size: string) => {
    setLocalFilters(prev => {
      if (prev.size.includes(size)) {
        return {...prev, size: prev.size.filter(s => s !== size)};
      } else {
        return {...prev, size: [...prev.size, size]};
      }
    });
  };
  
  const setDateFilter = (date: string) => {
    setLocalFilters(prev => ({...prev, date}));
  };
  
  const setLocationFilter = (location: string) => {
    setLocalFilters(prev => ({...prev, location}));
  };
  
  const resetFilters = () => {
    setLocalFilters({
      status: [],
      size: [],
      date: 'all',
      location: 'all'
    });
  };
  
  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Items</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              <View style={styles.filterOptions}>
                {['pending', 'accepted'].map(status => (
                  <TouchableOpacity 
                    key={status}
                    style={[
                      styles.filterChip,
                      localFilters.status.includes(status) ? 
                        { backgroundColor: colors.primary } : 
                        { backgroundColor: '#F0F0F0' }
                    ]}
                    onPress={() => toggleStatus(status)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.status.includes(status) ? '#fff' : '#333' }
                      ]}
                    >
                      {status === 'pending' ? 'Available' : 'Accepted'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Size Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Size</Text>
              <View style={styles.filterOptions}>
                {['small', 'medium', 'large'].map(size => (
                  <TouchableOpacity 
                    key={size}
                    style={[
                      styles.filterChip,
                      localFilters.size.includes(size) ? 
                        { backgroundColor: colors.primary } : 
                        { backgroundColor: '#F0F0F0' }
                    ]}
                    onPress={() => toggleSize(size)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.size.includes(size) ? '#fff' : '#333' }
                      ]}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Date Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Post Date</Text>
              <View style={styles.filterOptions}>
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' }
                ].map(option => (
                  <TouchableOpacity 
                    key={option.key}
                    style={[
                      styles.filterChip,
                      localFilters.date === option.key ? 
                        { backgroundColor: colors.primary } : 
                        { backgroundColor: '#F0F0F0' }
                    ]}
                    onPress={() => setDateFilter(option.key)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.date === option.key ? '#fff' : '#333' }
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Location Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Location</Text>
              <View style={styles.filterOptions}>
                {[
                  { key: 'all', label: 'All Locations' },
                  { key: 'nearby', label: 'Nearby' },
                  { key: 'international', label: 'International' },
                  { key: 'domestic', label: 'Domestic' }
                ].map(option => (
                  <TouchableOpacity 
                    key={option.key}
                    style={[
                      styles.filterChip,
                      localFilters.location === option.key ? 
                        { backgroundColor: colors.primary } : 
                        { backgroundColor: '#F0F0F0' }
                    ]}
                    onPress={() => setLocationFilter(option.key)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.location === option.key ? '#fff' : '#333' }
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetFilters}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.applyButton}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function FindItemsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDestination, setSearchDestination] = useState('');
  const { session } = useAuth();
  const navigation = useNavigation<FindItemsScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    status: [] as string[],
    size: [] as string[],
    date: 'all',
    location: 'all'
  });
  const [filterCount, setFilterCount] = useState(0);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchOrigin, searchDestination, items, activeFilters]);

  useEffect(() => {
    // Count active filters
    let count = 0;
    if (activeFilters.status.length) count += 1;
    if (activeFilters.size.length) count += 1;
    if (activeFilters.date !== 'all') count += 1;
    if (activeFilters.location !== 'all') count += 1;
    setFilterCount(count);
  }, [activeFilters]);

  const fetchItems = async () => {
    try {
      setError(null);
      
      if (!session?.user?.id) {
        setItems([]);
        setFilteredItems([]);
        setLoading(false);
        return;
      }
      
      // Fetch both pending items and items that this user is carrying
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          sender:profiles!items_user_id_fkey (
            id,
            name,
            avatar_url
          )
        `)
        .or(`status.eq.pending,and(status.eq.accepted,accepted_by.eq.${session.user.id})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedItems = data.map(item => ({
        ...item,
        sender: {
          id: item.sender.id,
          full_name: item.sender.name,
          avatar_url: item.sender.avatar_url
        }
      }));

      setItems(formattedItems);
      setFilteredItems(formattedItems);
      console.log(`Fetched ${formattedItems.length} items: ${formattedItems.filter(i => i.status === 'pending').length} pending, ${formattedItems.filter(i => i.status === 'accepted').length} accepted`);
    } catch (error) {
      console.error('Error fetching items:', error);
      setError('Failed to load items. Please try again.');
      Alert.alert('Error', 'Failed to load items. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...items];
    
    // Apply search filters
    if (searchOrigin) {
      filtered = filtered.filter(item => 
        item.pickup_location.toLowerCase().includes(searchOrigin.toLowerCase())
      );
    }
    
    if (searchDestination) {
      filtered = filtered.filter(item => 
        item.destination.toLowerCase().includes(searchDestination.toLowerCase())
      );
    }
    
    // Apply status filter
    if (activeFilters.status.length > 0) {
      filtered = filtered.filter(item => activeFilters.status.includes(item.status));
    }
    
    // Apply size filter
    if (activeFilters.size.length > 0) {
      filtered = filtered.filter(item => activeFilters.size.includes(item.size));
    }
    
    // Apply date filter
    if (activeFilters.date !== 'all') {
      const now = new Date();
      let cutoffDate;
      
      switch (activeFilters.date) {
        case 'today':
          cutoffDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          cutoffDate = subDays(now, 7);
          break;
        case 'month':
          cutoffDate = subMonths(now, 1);
          break;
        default:
          cutoffDate = new Date(0); // epoch time
      }
      
      filtered = filtered.filter(item => new Date(item.created_at) >= cutoffDate);
    }
    
    // Apply location filter
    if (activeFilters.location !== 'all') {
      // This is a placeholder for location filtering
      // In a real app, you'd need location data to properly filter
      switch (activeFilters.location) {
        case 'nearby':
          // Filter for nearby items (within 50 miles, for example)
          // This would require geolocation data
          break;
        case 'international':
          // Filter for international shipments
          // This might look for different country codes in origin/destination
          break;
        case 'domestic':
          // Filter for domestic shipments
          // This might look for same country codes in origin/destination
          break;
      }
    }
    
    setFilteredItems(filtered);
  };

  const handleApplyFilters = (filters: any) => {
    setActiveFilters(filters);
  };

  const handleContact = async (item: Item) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to contact senders.');
      return;
    }

    try {
      // Check if there's an existing conversation
      const { data: existingMessages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .or(`sender_id.eq.${item.sender.id},receiver_id.eq.${item.sender.id}`)
        .limit(1);

      if (messagesError) throw messagesError;

      // Navigate to chat with the sender
      (navigation as any).navigate('Messages', {
        screen: 'Chat',
        params: {
          otherUserId: item.sender.id.toString(),
          otherUserName: item.sender.name,
          itemId: item.id.toString()
        }
      });

      // If no existing conversation, create a welcome message
      if (!existingMessages || existingMessages.length === 0) {
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            sender_id: session.user.id,
            receiver_id: item.sender.id,
            content: `Hi! I'm interested in your item "${item.title}" from ${item.pickup_location} to ${item.destination}.`,
            item_id: item.id
          });

        if (messageError) throw messageError;
      }
    } catch (error: any) {
      console.error('Contact error:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  const handlePickupConfirmation = async (itemId: number, item: Item) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to pick up items.');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Pickup',
      `Are you sure you want to pick up this item?\n\n` +
      `Item: ${item.title}\n` +
      `From: ${item.pickup_location}\n` +
      `To: ${item.destination}\n` +
      `Size: ${item.size}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm Pickup',
          style: 'default',
          onPress: async () => {
            try {
              console.log('Starting pickup confirmation for item:', itemId);
              
              // First, verify the item is still pending
              const { data: itemData, error: fetchError } = await supabase
                .from('items')
                .select('status, user_id')
                .eq('id', itemId)
                .single();

              console.log('Item verification result:', { data: itemData, error: fetchError });
              
              if (fetchError) {
                console.error('Error verifying item status:', fetchError);
                throw fetchError;
              }
              
              if (!itemData) {
                console.error('Item not found:', itemId);
                Alert.alert('Error', 'Item not found. Please try again.');
                return;
              }
              
              if (itemData.status !== 'pending') {
                console.log('Item already picked up, status:', itemData.status);
                Alert.alert('Error', 'This item is no longer available for pickup.');
                return;
              }

              // Calculate estimated delivery date (3 days from now)
              const estimatedDelivery = new Date();
              estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

              console.log('Updating item status to accepted for user:', session.user.id);
              
              // Update item status to 'accepted'
              const updateResult = await supabase
                .from('items')
                .update({ 
                  status: 'accepted',
                  accepted_by: session.user.id,
                  pickup_date: new Date().toISOString(),
                  estimated_delivery_date: estimatedDelivery.toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', itemId)
                .eq('status', 'pending')  // Only update if status is still pending
                .select();

              console.log('Update result:', updateResult);
              
              if (updateResult.error) {
                console.error('Error updating item status:', updateResult.error);
                throw updateResult.error;
              }
              
              if (updateResult.data && updateResult.data.length === 0) {
                console.warn('Update returned no results, possible row not found or status already changed');
              }

              // Create a pickup notification message
              console.log('Sending pickup notification to sender:', itemData.user_id);
              const messageResult = await supabase
                .from('messages')
                .insert({
                  sender_id: session.user.id,
                  receiver_id: itemData.user_id,
                  content: `I have picked up "${item.title}" and will deliver it to ${item.destination}.`,
                  item_id: itemId,
                  created_at: new Date().toISOString()
                })
                .select();

              console.log('Message result:', messageResult);
              
              if (messageResult.error) {
                console.error('Error sending pickup message:', messageResult.error);
                // Continue the process even if message fails
              }

              // Refresh the items list
              await fetchItems();
              
              // Navigate to pickup details screen
              navigation.navigate('PickupDetails', {
                itemId: item.id.toString(),
                item: {
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  pickup_location: item.pickup_location,
                  destination: item.destination,
                  size: item.size,
                  image_url: item.image_url,
                  user_id: item.user_id,
                  status: 'accepted',
                  created_at: item.created_at,
                  sender: item.sender
                }
              });
            } catch (err: any) {
              console.error('Error confirming pickup:', err);
              Alert.alert('Error', `Failed to confirm pickup: ${err.message || 'Unknown error'}`);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleCancelPickup = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ status: 'pending' })
        .eq('id', itemId);

      if (error) throw error;

      Alert.alert('Success', 'Pickup has been canceled.');
      fetchItems(); // Refresh the item list
    } catch (error) {
      console.error('Error canceling pickup:', error);
      Alert.alert('Error', 'Failed to cancel pickup. Please try again.');
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchItems().finally(() => setRefreshing(false));
  }, []);

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity 
      style={styles.itemCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('PickupDetails', {
        itemId: item.id.toString(),
        item: {
          id: item.id,
          title: item.title,
          description: item.description,
          pickup_location: item.pickup_location,
          destination: item.destination,
          size: item.size,
          image_url: item.image_url,
          user_id: item.user_id,
          status: item.status,
          created_at: item.created_at,
          sender: item.sender
        }
      })}
    >
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.itemImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={30} color={colors.text.secondary} />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'pending' ? '#FFA500' : '#32CD32' }]}>
          <Ionicons 
            name={item.status === 'pending' ? 'time-outline' : 'checkmark-circle-outline'} 
            size={14} 
            color="#fff" 
          />
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup_location} to {item.destination}
          </Text>
        </View>
        
        <View style={styles.itemFooter}>
          <View style={styles.sizeContainer}>
            <Ionicons 
              name={item.size === 'small' ? 'cube-outline' : item.size === 'medium' ? 'cube' : 'cube-sharp'} 
              size={14} 
              color={colors.text.secondary} 
            />
            <Text style={styles.sizeText}>{item.size}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => handleContact(item)}
          >
            <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={80} color={colors.text.secondary} />
      <Text style={styles.emptyText}>
        No items found. Try adjusting your search criteria.
      </Text>
    </View>
  );

  const ErrorState = ({ message }: { message: string }) => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={120} color={colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Items</Text>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterCount > 0 ? { backgroundColor: colors.primary } : {}
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons 
            name="filter" 
            size={18} 
            color={filterCount > 0 ? '#fff' : colors.primary} 
          />
          <Text 
            style={[
              styles.filterButtonText, 
              filterCount > 0 ? { color: '#fff' } : {}
            ]}
          >
            {filterCount > 0 ? `Filters (${filterCount})` : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredItems.length === 0 && filterCount > 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={colors.text.secondary} />
          <Text style={styles.emptyText}>
            No matching items found
          </Text>
          <Text style={styles.emptySubtext}>
            Try adjusting your filters to see more results
          </Text>
          <TouchableOpacity 
            style={styles.resetFiltersButton}
            onPress={() => setActiveFilters({ status: [], size: [], date: 'all', location: 'all' })}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.resetFiltersText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={EmptyState}
        />
      )}

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={activeFilters}
        onApplyFilters={handleApplyFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  filters: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  selectedFilter: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: '#666666',
  },
  selectedFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  gridContainer: {
    padding: 16,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    width: cardWidth,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: cardWidth,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  cardContent: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666666',
    flex: 1,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sizeText: {
    fontSize: 12,
    color: '#666666',
  },
  contactButton: {
    padding: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickupButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  pickupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    marginBottom: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  resetFiltersText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
}); 