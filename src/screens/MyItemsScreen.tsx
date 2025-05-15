import React, { useEffect, useState, useCallback } from 'react';
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
  Dimensions,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { format, subDays, subMonths } from 'date-fns';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeStackParamList, TabParamList } from '../navigation/types';

const { width } = Dimensions.get('window');
const numColumns = 2;
const cardWidth = (width - 48) / numColumns;

type Item = {
  id: string;
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  size: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'delivered';
  created_at: string;
  image_url?: string;
};

type StatusConfig = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type MyItemsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'MyItems'>,
  BottomTabNavigationProp<TabParamList>
>;

const LoadingSkeleton = () => (
  <View style={styles.skeletonGrid}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonPrice} />
        </View>
      </View>
    ))}
  </View>
);

const FilterModal = ({ 
  visible, 
  onClose, 
  filters, 
  onApplyFilters,
  theme 
}: { 
  visible: boolean, 
  onClose: () => void, 
  filters: {
    status: string[],
    size: string[],
    date: string
  }, 
  onApplyFilters: (filters: any) => void,
  theme: any
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
  
  const resetFilters = () => {
    setLocalFilters({
      status: [],
      size: [],
      date: 'all'
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
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Filter Items</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>Status</Text>
              <View style={styles.filterOptions}>
                {['pending', 'accepted', 'delivered'].map(status => (
                  <TouchableOpacity 
                    key={status}
                    style={[
                      styles.filterChip,
                      localFilters.status.includes(status) ? 
                        { backgroundColor: theme.colors.primary } : 
                        { backgroundColor: theme.colors.border }
                    ]}
                    onPress={() => toggleStatus(status)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.status.includes(status) ? '#fff' : theme.colors.text }
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Size Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>Size</Text>
              <View style={styles.filterOptions}>
                {['small', 'medium', 'large'].map(size => (
                  <TouchableOpacity 
                    key={size}
                    style={[
                      styles.filterChip,
                      localFilters.size.includes(size) ? 
                        { backgroundColor: theme.colors.primary } : 
                        { backgroundColor: theme.colors.border }
                    ]}
                    onPress={() => toggleSize(size)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.size.includes(size) ? '#fff' : theme.colors.text }
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
              <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>Date Posted</Text>
              <View style={styles.filterOptions}>
                {[
                  { key: 'all', label: 'All Time' },
                  { key: 'week', label: 'Last Week' },
                  { key: 'month', label: 'Last Month' },
                  { key: 'three_months', label: 'Last 3 Months' }
                ].map(option => (
                  <TouchableOpacity 
                    key={option.key}
                    style={[
                      styles.filterChip,
                      localFilters.date === option.key ? 
                        { backgroundColor: theme.colors.primary } : 
                        { backgroundColor: theme.colors.border }
                    ]}
                    onPress={() => setDateFilter(option.key)}
                  >
                    <Text 
                      style={[
                        styles.filterChipText, 
                        { color: localFilters.date === option.key ? '#fff' : theme.colors.text }
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
              style={[styles.resetButton, { borderColor: theme.colors.border }]}
              onPress={resetFilters}
            >
              <Text style={[styles.resetButtonText, { color: theme.colors.text }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.applyButton, { backgroundColor: theme.colors.primary }]}
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

export const MyItemsScreen = () => {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    status: [] as string[],
    size: [] as string[],
    date: 'all'
  });
  const [filterCount, setFilterCount] = useState(0);
  const navigation = useNavigation<MyItemsScreenNavigationProp>();

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, activeFilters]);

  useEffect(() => {
    // Count active filters
    let count = 0;
    if (activeFilters.status.length) count += 1;
    if (activeFilters.size.length) count += 1;
    if (activeFilters.date !== 'all') count += 1;
    setFilterCount(count);
  }, [activeFilters]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...items];
    
    // Apply status filter
    if (activeFilters.status.length > 0) {
      result = result.filter(item => activeFilters.status.includes(item.status));
    }
    
    // Apply size filter
    if (activeFilters.size.length > 0) {
      result = result.filter(item => activeFilters.size.includes(item.size));
    }
    
    // Apply date filter
    if (activeFilters.date !== 'all') {
      const now = new Date();
      let cutoffDate;
      
      switch (activeFilters.date) {
        case 'week':
          cutoffDate = subDays(now, 7);
          break;
        case 'month':
          cutoffDate = subMonths(now, 1);
          break;
        case 'three_months':
          cutoffDate = subMonths(now, 3);
          break;
        default:
          cutoffDate = new Date(0); // epoch time
      }
      
      result = result.filter(item => new Date(item.created_at) >= cutoffDate);
    }
    
    setFilteredItems(result);
  };

  const handleApplyFilters = (filters: any) => {
    setActiveFilters(filters);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchItems();
  }, []);

  const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
      case 'pending':
        return { color: '#FFA500', icon: 'time-outline' };
      case 'accepted':
        return { color: '#32CD32', icon: 'checkmark-circle-outline' };
      case 'delivered':
        return { color: '#4169E1', icon: 'checkmark-done-circle-outline' };
      default:
        return { color: '#000', icon: 'alert-circle-outline' };
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const statusConfig = getStatusConfig(item.status);
    
    return (
      <TouchableOpacity 
        style={styles.itemCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ItemDetails', { itemId: item.id })}
      >
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: theme.colors.border }]}>
              <Ionicons name="image-outline" size={30} color={theme.colors.textSecondary} />
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon} size={14} color="#fff" />
            <Text style={styles.statusText}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickup_location}
            </Text>
          </View>
          
          <View style={styles.itemFooter}>
            <View style={styles.sizeContainer}>
              <Ionicons 
                name={item.size === 'small' ? 'cube-outline' : item.size === 'medium' ? 'cube' : 'cube-sharp'} 
                size={14} 
                color={theme.colors.textSecondary} 
              />
              <Text style={styles.sizeText}>{item.size}</Text>
            </View>
            <Text style={styles.dateText}>
              {format(new Date(item.created_at), 'MMM d')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>My Items</Text>
        <TouchableOpacity 
          style={[
            styles.filterButton, 
            { backgroundColor: filterCount > 0 ? theme.colors.primary : theme.colors.card }
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons 
            name="filter" 
            size={18} 
            color={filterCount > 0 ? '#fff' : theme.colors.text} 
          />
          <Text 
            style={[
              styles.filterText, 
              { color: filterCount > 0 ? '#fff' : theme.colors.text }
            ]}
          >
            {filterCount > 0 ? `Filters (${filterCount})` : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            You haven't posted any items yet
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Start by posting your first item to find a traveler
          </Text>
          <TouchableOpacity 
            style={[styles.postButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => navigation.navigate('PostItem', undefined)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.postButtonText}>Post New Item</Text>
          </TouchableOpacity>
        </View>
      ) : filteredItems.length === 0 && filterCount > 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
            No matching items
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
            Try adjusting your filters to see more results
          </Text>
          <TouchableOpacity 
            style={[styles.postButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setActiveFilters({ status: [], size: [], date: 'all' })}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.postButtonText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('PostItem', undefined)}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={activeFilters}
        onApplyFilters={handleApplyFilters}
        theme={theme}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    paddingBottom: 80,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    width: cardWidth,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
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
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  cardContent: {
    padding: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    color: '#666',
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
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  // Skeleton styles
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: cardWidth,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  skeletonImage: {
    width: '100%',
    height: cardWidth,
    backgroundColor: '#EEEEEE',
  },
  skeletonContent: {
    padding: 12,
    gap: 8,
  },
  skeletonTitle: {
    height: 16,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    width: '80%',
  },
  skeletonPrice: {
    height: 14,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    width: '40%',
  },
  // Add these new styles for the filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
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
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  }
}); 