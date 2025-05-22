import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MessagesStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type NewChatScreenNavigationProp = NativeStackNavigationProp<MessagesStackParamList, 'NewChat'>;

type User = {
  id: string;
  name: string;
  avatar_url: string | null;
};

const NewChatScreen = () => {
  const navigation = useNavigation<NewChatScreenNavigationProp>();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: 'New Chat',
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: Platform.OS === 'ios' ? '600' : '700',
        color: colors.primary,
      },
      headerStyle: {
        backgroundColor: '#ffffff',
      },
    });
  }, [navigation]);

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .neq('id', profile?.id) // Exclude current user
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (user: User) => {
    try {
      // Check if conversation already exists
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${profile?.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${profile?.id})`)
        .single();

      if (existingConversation) {
        // Navigate to existing conversation
        navigation.navigate('Chat', {
          otherUserId: user.id,
          otherUserName: user.name,
          otherUserAvatar: user.avatar_url
        });
      } else {
        // Create new conversation
        const { data: newConversation, error } = await supabase
          .from('conversations')
          .insert({
            user1_id: profile?.id,
            user2_id: user.id,
            last_message: null,
            last_message_at: null,
            unread_count: 0
          })
          .select()
          .single();

        if (error) throw error;

        // Navigate to new conversation
        navigation.navigate('Chat', {
          otherUserId: user.id,
          otherUserName: user.name,
          otherUserAvatar: user.avatar_url
        });
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to create conversation');
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image
            source={{ uri: item.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {item.name[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.userName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users"
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchUsers(text);
          }}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            searchQuery ? (
              <Text style={styles.emptyText}>No users found</Text>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    height: 40,
    ...Platform.select({
      ios: {
        padding: 0,
      },
    }),
  },
  listContainer: {
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    color: '#8E8E93',
  },
  userName: {
    fontSize: 17,
    color: '#000000',
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  emptyText: {
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

export default NewChatScreen; 