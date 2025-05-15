import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';
import { RootStackParamList } from '../navigation/types';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

type RouteParams = {
  itemId: string;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Item = {
  id: string;
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  size: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'delivered';
  created_at: string;
  updated_at: string;
  user_id: string;
  image_url?: string;
};

type SizeOption = {
  label: string;
  value: 'small' | 'medium' | 'large';
  weightRange: string;
  icon: string;
};

const SIZE_OPTIONS: SizeOption[] = [
  {
    label: 'Small',
    value: 'small',
    weightRange: '1-5 kg',
    icon: 'cube-outline',
  },
  {
    label: 'Medium',
    value: 'medium',
    weightRange: '5-15 kg',
    icon: 'cube',
  },
  {
    label: 'Large',
    value: 'large',
    weightRange: '15-30 kg',
    icon: 'cube-sharp',
  },
];

// Add base64 to array buffer conversion
const decode = (base64: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const bufferLength = base64.length * 0.75;
  const arraybuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arraybuffer);

  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  for (let i = 0; i < base64.length; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
};

export default function ItemDetailsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { itemId } = route.params as RouteParams;
  const { session } = useAuth();
  
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    fetchItemDetails();
  }, [itemId]);

  useEffect(() => {
    // Set navigation options
    navigation.setOptions({
      headerTitle: () => (
        <Text style={styles.headerTitle}>
          {editMode ? 'Edit Item' : 'Item Details'}
        </Text>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          {!editMode && (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShareItem}
              >
                <Ionicons name="share-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
              {(item?.status === 'pending' || item?.status === 'accepted') && item?.user_id === session?.user?.id && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setEditMode(true)}
                >
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
          {editMode && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setTitle(item?.title || '');
                setDescription(item?.description || '');
                setPickupLocation(item?.pickup_location || '');
                setDestination(item?.destination || '');
                setSize(item?.size || 'medium');
                setImage(item?.image_url || null);
                setEditMode(false);
              }}
            >
              <Ionicons name="close" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, editMode, item, session?.user?.id]);

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setItem(data);
        // Initialize form fields with item data
        setTitle(data.title);
        setDescription(data.description || '');
        setPickupLocation(data.pickup_location);
        setDestination(data.destination);
        setSize(data.size);
        setImage(data.image_url || null);
      }
    } catch (error: any) {
      console.error('Error fetching item details:', error.message);
      Alert.alert('Error', 'Failed to load item details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    try {
      console.log('Starting image upload process...');
      
      // Generate a unique filename using timestamp and random string
      const fileName = `item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Simple extension detection
      let fileExt = uri.includes('.') ? uri.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
      let contentType = 'image/jpeg'; // Default content type
      
      if (fileExt === 'png') contentType = 'image/png';
      if (fileExt === 'gif') contentType = 'image/gif';
      
      const filePath = `${fileName}.${fileExt}`;

      console.log('Upload details:', { 
        uri, 
        filePath, 
        contentType,
        fileExt,
        bucketName: 'items',
      });

      // Read the file
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (!base64) {
        console.error('Failed to read image data - empty base64 string');
        return null;
      }
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('items')
        .upload(filePath, decode(base64), {
          contentType,
          upsert: true
        });

      if (error) {
        console.error('Upload error:', error.message);
        Alert.alert('Upload Error', `Failed to upload image: ${error.message}`);
        return null;
      }

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('items')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
      
    } catch (error: any) {
      console.error('Image upload error:', error.message);
      Alert.alert('Error', 'Failed to upload image');
      return null;
    }
  };

  const handleUpdateItem = async () => {
    if (!session?.user?.id || !item) return;
    
    // Validate fields
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your item');
      return;
    }
    
    if (!pickupLocation.trim()) {
      Alert.alert('Error', 'Please enter a pickup location');
      return;
    }
    
    if (!destination.trim()) {
      Alert.alert('Error', 'Please enter a destination');
      return;
    }
    
    try {
      setUpdating(true);
      
      // Check if user owns this item
      if (item.user_id !== session.user.id) {
        Alert.alert('Error', 'You can only edit your own items');
        return;
      }
      
      // Can update pending or accepted items
      if (item.status !== 'pending' && item.status !== 'accepted') {
        Alert.alert('Error', 'You can only edit pending or accepted items');
        return;
      }
      
      // Handle image upload if there's a new image
      let imageUrl = item.image_url;
      if (image && !image.startsWith('http')) {
        // This is a new local image, upload it
        const uploadedUrl = await uploadImageToStorage(image);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }
      
      // Update the item
      const { error } = await supabase
        .from('items')
        .update({
          title,
          description,
          pickup_location: pickupLocation,
          destination,
          size,
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .eq('user_id', session.user.id)
        .in('status', ['pending', 'accepted']);
      
      if (error) throw error;
      
      Alert.alert('Success', 'Item updated successfully');
      setEditMode(false);
      
      // Refresh item details
      fetchItemDetails();
      
    } catch (error: any) {
      console.error('Error updating item:', error.message);
      Alert.alert('Error', `Failed to update item: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!session?.user?.id || !item) return;
    
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              
              // Check if user owns this item
              if (item.user_id !== session.user.id) {
                Alert.alert('Error', 'You can only delete your own items');
                return;
              }
              
              // Can only delete pending items
              if (item.status !== 'pending') {
                Alert.alert('Error', 'You can only delete pending items');
                return;
              }
              
              // Delete the item
              const { error } = await supabase
                .from('items')
                .delete()
                .eq('id', itemId)
                .eq('user_id', session.user.id)
                .eq('status', 'pending');
              
              if (error) throw error;
              
              // Show success message with animation
              Alert.alert(
                'Success',
                'Item deleted successfully',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back with animation
                      navigation.goBack();
                    }
                  }
                ]
              );
              
            } catch (error: any) {
              console.error('Error deleting item:', error.message);
              Alert.alert('Error', `Failed to delete item: ${error.message}`);
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleShareItem = async () => {
    try {
      if (!item) return;
      
      // Generate a shareable URL
      const shareUrl = `https://adera.app/items/${itemId}`;
      
      const shareMessage = `Check out this item on Adera: ${item.title}
From: ${item.pickup_location}
To: ${item.destination}
Size: ${item.size}

${shareUrl}`;

      await Share.share({
        message: shareMessage,
        url: Platform.OS === 'ios' ? shareUrl : undefined,
        title: `Adera Item: ${item.title}`,
      });
    } catch (error: any) {
      console.error('Error sharing item:', error);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#FFA500', icon: 'time-outline', label: 'Pending' };
      case 'accepted':
        return { color: '#32CD32', icon: 'checkmark-circle-outline', label: 'Accepted' };
      case 'delivered':
        return { color: '#4169E1', icon: 'checkmark-done-circle-outline', label: 'Delivered' };
      default:
        return { color: '#000', icon: 'alert-circle-outline', label: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading item details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Item Not Found</Text>
        <Text style={styles.errorText}>This item may have been deleted or doesn't exist</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getStatusConfig(item.status);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={16} color="#fff" />
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
        </View>
        
        {/* Item Image */}
        <View style={styles.imageContainer}>
          {editMode ? (
            <>
              {image ? (
                <Image source={{ uri: image }} style={styles.itemImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="image-outline" size={64} color={colors.border} />
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.changeImageButton}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.changeImageText}>
                  {image ? 'Change Image' : 'Add Image'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            image ? (
              <Image source={{ uri: image }} style={styles.itemImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={64} color={colors.border} />
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )
          )}
        </View>
        
        {/* Item Details Form/View */}
        <View style={styles.detailsContainer}>
          {editMode ? (
            /* Edit Mode */
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter item title"
                  maxLength={50}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter item description"
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Pickup Location</Text>
                <TextInput
                  style={styles.input}
                  value={pickupLocation}
                  onChangeText={setPickupLocation}
                  placeholder="Enter pickup location"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Destination</Text>
                <TextInput
                  style={styles.input}
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="Enter destination"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Item Size</Text>
                <View style={styles.sizeOptionsContainer}>
                  {SIZE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.sizeOption,
                        size === option.value && styles.selectedSizeOption
                      ]}
                      onPress={() => setSize(option.value)}
                    >
                      <Ionicons 
                        name={option.icon as any}
                        size={24} 
                        color={size === option.value ? colors.primary : colors.text.secondary} 
                      />
                      <Text
                        style={[
                          styles.sizeOptionLabel,
                          size === option.value && styles.selectedSizeOptionLabel
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.sizeOptionSubtext}>{option.weightRange}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Action Buttons */}
              <Animated.View 
                entering={FadeInDown.delay(200).springify()}
                style={styles.actionButtonsContainer}
              >
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleDeleteItem}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Delete Item</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.updateButton]}
                  onPress={handleUpdateItem}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Update</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </>
          ) : (
            /* View Mode */
            <>
              <Text style={styles.itemTitle}>{item.title}</Text>
              
              {item.description ? (
                <Text style={styles.description}>{item.description}</Text>
              ) : (
                <Text style={styles.noDescription}>No description provided</Text>
              )}
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Pickup Location</Text>
                  <Text style={styles.infoValue}>{item.pickup_location}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="location" size={20} color={colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Destination</Text>
                  <Text style={styles.infoValue}>{item.destination}</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <Ionicons 
                    name={
                      item.size === 'small' ? 'cube-outline' : 
                      item.size === 'medium' ? 'cube' : 'cube-sharp'
                    } 
                    size={20} 
                    color={colors.primary} 
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Size</Text>
                  <Text style={styles.infoValue}>
                    {item.size.charAt(0).toUpperCase() + item.size.slice(1)}
                    {' '}
                    ({SIZE_OPTIONS.find(o => o.value === item.size)?.weightRange})
                  </Text>
                </View>
              </View>
              
              {/* Action Buttons */}
              {(item.status === 'pending' || item.status === 'accepted') && item.user_id === session?.user?.id && (
                <Animated.View 
                  entering={FadeInDown.delay(200).springify()}
                  style={styles.actionButtonsContainer}
                >
                  {item.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={handleDeleteItem}
                      disabled={updating}
                    >
                      {updating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={20} color="#fff" />
                          <Text style={styles.actionButtonText}>Delete Item</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => setEditMode(true)}
                    disabled={updating}
                  >
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Edit Item</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              {/* Status-specific UI */}
              {item.status === 'accepted' && (
                <View style={styles.statusNotification}>
                  <Ionicons name="checkmark-circle" size={24} color="#32CD32" />
                  <Text style={styles.statusNotificationText}>
                    This item has been picked up by a traveler
                  </Text>
                </View>
              )}
              
              {item.status === 'delivered' && (
                <View style={styles.statusNotification}>
                  <Ionicons name="checkmark-done-circle" size={24} color="#4169E1" />
                  <Text style={styles.statusNotificationText}>
                    This item has been delivered successfully
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFA500',
    ...shadows.small,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
    marginBottom: 16,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    color: colors.text.secondary,
    marginTop: 8,
  },
  changeImageButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changeImageText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  detailsContainer: {
    padding: 16,
  },
  itemTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 24,
    lineHeight: 22,
  },
  noDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    ...shadows.medium,
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  updateButton: {
    backgroundColor: colors.primary,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  statusNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  statusNotificationText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.text.primary,
    flexShrink: 1,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sizeOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sizeOption: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selectedSizeOption: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  sizeOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: 8,
  },
  selectedSizeOptionLabel: {
    color: colors.primary,
  },
  sizeOptionSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
}); 