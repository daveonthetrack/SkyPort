import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeInUp,
    Layout,
    SlideInRight
} from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { HomeStackParamList } from '../navigation/types';
import { colors, shadows, spacing, typography } from '../theme';
import { Item } from '../types/item';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - spacing.md * 2;

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, 'DeliveredItems'>;

export default function DeliveredItemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalDelivered: 0,
    thisMonth: 0,
    thisWeek: 0,
  });

  const fetchDeliveredItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          owner:profiles!user_id (
            id,
            name,
            avatar_url
          )
        `)
        .eq('accepted_by', user.id)
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const thisWeek = data?.filter(item => 
        new Date(item.updated_at) >= startOfWeek
      ).length || 0;

      const thisMonth = data?.filter(item => 
        new Date(item.updated_at) >= startOfMonth
      ).length || 0;

      setStats({
        totalDelivered: data?.length || 0,
        thisWeek,
        thisMonth,
      });

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching delivered items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDeliveredItems();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveredItems();
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsCard}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsGradient}
        >
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalDelivered}</Text>
            <Text style={styles.statLabel}>Total Delivered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.thisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );

  const handleItemPress = (itemId: string) => {
    navigation.navigate('TravelerItemDetails', { 
      itemId
    });
  };

  const renderItem = ({ item, index }: { item: Item; index: number }) => {
    const formattedDate = item.updated_at
      ? format(new Date(item.updated_at), 'MMM d, yyyy')
      : 'Unknown date';

    return (
      <Animated.View
        entering={SlideInRight.delay(index * 100).springify()}
        layout={Layout.springify()}
      >
        <TouchableOpacity
          style={styles.itemCard}
          onPress={() => handleItemPress(item.id.toString())}
        >
          <View style={styles.itemCardContent}>
            <Image
              source={{ uri: item.image_url || 'https://via.placeholder.com/100' }}
              style={styles.itemImage}
            />
            <View style={styles.itemInfo}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={[styles.statusBadge, styles.deliveredBadge]}>
                  <Text style={styles.statusText}>Delivered</Text>
                </View>
              </View>
              
              <View style={styles.itemDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="cube-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.detailText}>
                    {item.size.charAt(0).toUpperCase() + item.size.slice(1)} Package
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.detailText}>{formattedDate}</Text>
                </View>
              </View>

              <View style={styles.userInfo}>
                <Image
                  source={{ uri: item.owner?.avatar_url || 'https://via.placeholder.com/40' }}
                  style={styles.userAvatar}
                />
                <View style={styles.userDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.owner?.name || 'Unknown'}
                  </Text>
                  <Text style={styles.itemTime}>Delivered on {formattedDate}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => handleItemPress(item.id.toString())}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderStats()}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <Animated.View 
            entering={FadeInUp.delay(400).springify()}
            style={styles.emptyContainer}
          >
            <Ionicons name="cube-outline" size={64} color={colors.text.secondary} />
            <Text style={styles.emptyText}>No delivered items yet</Text>
            <Text style={styles.emptySubtext}>
              Items you've delivered will appear here
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  statsContainer: {
    padding: spacing.md,
  },
  statsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.medium,
  },
  statsGradient: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.9,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
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
    borderRadius: 12,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  itemDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.background,
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
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: colors.success + '20',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.success,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: typography.sizes.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
}); 