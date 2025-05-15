import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  FlatList
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { GOOGLE_PLACES_API_KEY } from '../config/apiKeys';
import LocationAutocomplete from '../components/GooglePlaces/LocationAutocomplete';
import { useNavigation } from '@react-navigation/native';
import { testDatabaseConnection } from '../lib/testConnection';

// Sample items for quick-fill functionality
const SAMPLE_ITEMS = [
  {
    id: '1',
    title: 'Smartphone',
    description: 'New smartphone in original packaging. Needs to be delivered carefully and quickly.',
    size: 'small' as const,
    category: 'Electronics'
  },
  {
    id: '2',
    title: 'Important Documents',
    description: 'Legal documents that need to be delivered securely. Please handle with care.',
    size: 'small' as const,
    category: 'Documents'
  },
  {
    id: '3',
    title: 'Laptop',
    description: 'A 15-inch laptop in protective case that needs to be delivered. Keep away from water and handle with care.',
    size: 'medium' as const,
    category: 'Electronics'
  },
  {
    id: '4',
    title: 'Gift Package',
    description: 'Birthday gift package with fragile items inside. Please ensure safe delivery.',
    size: 'medium' as const,
    category: 'Gifts'
  },
  {
    id: '5',
    title: 'Textbooks',
    description: 'Set of university textbooks that need to be delivered to a student. Not fragile but somewhat heavy.',
    size: 'large' as const,
    category: 'Books'
  },
  {
    id: '6',
    title: 'Medications',
    description: 'Important prescription medications that need to be delivered promptly. Keep at room temperature.',
    size: 'small' as const,
    category: 'Medical'
  },
];

// Add our own implementation of base64 to array buffer conversion
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

// QuickFill item modal component
const QuickFillModal = ({
  visible,
  onClose,
  onSelectItem,
  items
}: {
  visible: boolean,
  onClose: () => void,
  onSelectItem: (item: typeof SAMPLE_ITEMS[0]) => void,
  items: typeof SAMPLE_ITEMS
}) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Item Template</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.itemTemplate}
              onPress={() => onSelectItem(item)}
            >
              <View style={styles.itemTemplateHeader}>
                <Ionicons 
                  name={SIZE_OPTIONS.find(s => s.value === item.size)?.icon as any || 'cube'} 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={styles.itemTemplateTitle}>{item.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              </View>
              <Text style={styles.itemTemplateDescription} numberOfLines={2}>
                {item.description}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  </Modal>
);

const AnimatedText = Animated.createAnimatedComponent(Text);

export function PostItemScreen() {
  const navigation = useNavigation();
  const { profile, session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  
  // Add validation states
  const [titleError, setTitleError] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);
  const [pickupLocationError, setPickupLocationError] = useState(false);
  const [destinationError, setDestinationError] = useState(false);
  
  // Add quick-fill state
  const [showQuickFillModal, setShowQuickFillModal] = useState(false);

  useEffect(() => {
    fetchUserProfile();
    navigation.setOptions({
      headerTitle: () => (
        <Text style={styles.headerTitle}>Post New Item</Text>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowQuickFillModal(true)}
        >
          <Ionicons name="list" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchUserProfile = async () => {
    try {
      if (!session?.user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load user profile');
        return;
      }

      if (!data) {
        Alert.alert('Error', 'User profile not found');
        navigation.goBack();
        return;
      }

      // Check for required fields
      if (!data.name && !data.username && !data.full_name) {
        Alert.alert('Error', 'User profile incomplete. Please complete your profile first.');
        navigation.goBack();
        return;
      }

      // Use whichever name field is available
      const userName = data.name || data.username || data.full_name;
      setUserName(userName);
      setUserAvatar(data.avatar_url || null);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    }
  };

  // Function to handle selecting a template item
  const selectItemTemplate = (item: typeof SAMPLE_ITEMS[0]) => {
    setTitle(item.title);
    setDescription(item.description);
    setSize(item.size);
    
    // Clear validation errors for filled fields
    setTitleError(false);
    setDescriptionError(false);
    
    setShowQuickFillModal(false);
  };

  // Validate all form fields
  const validateForm = () => {
    let isValid = true;
    
    if (!title.trim()) {
      setTitleError(true);
      isValid = false;
      console.log('Title validation failed');
    } else {
      setTitleError(false);
    }
    
    if (!description.trim() || description.length < 10) {
      setDescriptionError(true);
      isValid = false;
      console.log('Description validation failed');
    } else {
      setDescriptionError(false);
    }
    
    if (!pickupLocation.trim()) {
      setPickupLocationError(true);
      isValid = false;
      console.log('Pickup location validation failed');
    } else {
      setPickupLocationError(false);
    }
    
    if (!destination.trim()) {
      setDestinationError(true);
      isValid = false;
      console.log('Destination validation failed');
    } else {
      setDestinationError(false);
    }
    
    console.log('Form validation result:', isValid);
    return isValid;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    try {
      // First, check if the file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get file extension from URI
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = `image/${fileExt === 'png' ? 'png' : 'jpeg'}`;

      // Generate a unique filename
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('items')
        .upload(fileName, bytes, {
          contentType,
          cacheControl: '3600',
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('items')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        'Upload Error',
        'Failed to upload image. Please try again.',
        [{ text: 'OK' }]
      );
      return null;
    }
  };

  const handlePostItem = async () => {
    if (!validateForm() || !session?.user?.id) {
      console.log('Form validation failed or no user session');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting item post process...');

      // Test database connection first
      console.log('Testing database connection...');
      const connectionTest = await testDatabaseConnection();
      console.log('Database connection test results:', connectionTest);

      if (!connectionTest.items) {
        throw new Error('Cannot access items table. Please check database permissions.');
      }

      // Validate required fields
      if (!title || !description || !pickupLocation || !destination) {
        console.log('Missing required fields:', {
          title: !!title,
          description: !!description,
          pickupLocation: !!pickupLocation,
          destination: !!destination
        });
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      let imageUrl = null;
      if (image) {
        console.log('Starting image upload...');
        try {
          imageUrl = await uploadImageToStorage(image);
          if (!imageUrl) {
            throw new Error('Failed to upload image');
          }
          console.log('Image uploaded successfully:', imageUrl);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
          return;
        }
      }

      console.log('Preparing to insert item into database...');
      const itemData = {
        title: title,
        description,
        size,
        pickup_location: pickupLocation,
        destination,
        image_url: imageUrl,
        user_id: session.user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      console.log('Item data:', itemData);

      // First, check if we can connect to the database
      const { data: testConnection, error: connectionError } = await supabase
        .from('items')
        .select('id')
        .limit(1);

      if (connectionError) {
        console.error('Database connection error:', connectionError);
        throw new Error('Failed to connect to database');
      }

      // Now try to insert the item
      const { data: item, error: insertError } = await supabase
        .from('items')
        .insert([itemData])
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw insertError;
      }

      if (!item) {
        console.error('No item data returned after insert');
        throw new Error('Failed to create item');
      }

      console.log('Item posted successfully:', item);

      Alert.alert(
        'Success',
        'Item posted successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setLoading(false);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error posting item:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to post item. Please check your connection and try again.'
      );
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedText 
            entering={FadeInUp.delay(200).springify()}
            style={styles.title}
          >
            Post New Item
          </AnimatedText>
          
          <Animated.View 
            entering={FadeInUp.delay(300).springify()}
            style={styles.quickOptionsContainer}
          >
            <TouchableOpacity 
              style={styles.quickFillButton}
              onPress={() => setShowQuickFillModal(true)}
            >
              <Ionicons name="flash" size={16} color={colors.primary} />
              <Text style={styles.quickFillText}>Quick Fill</Text>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInUp.delay(400).springify()}
            style={styles.inputContainer}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Item Title <Text style={styles.asterisk}>*</Text></Text>
              {titleError && <Text style={styles.errorText}>Required</Text>}
            </View>
            <TextInput
              style={[styles.input, titleError && styles.inputError]}
              placeholder="Enter item title"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (text.trim()) setTitleError(false);
              }}
              onBlur={() => {
                if (!title.trim()) setTitleError(true);
              }}
              maxLength={50}
            />
          </Animated.View>
          
          <Animated.View 
            entering={FadeInUp.delay(500).springify()}
            style={styles.inputContainer}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Description <Text style={styles.asterisk}>*</Text></Text>
              {descriptionError && 
                <Text style={styles.errorText}>
                  {!description.trim() ? 'Required' : 'Min. 10 characters'}
                </Text>
              }
            </View>
            <TextInput
              style={[styles.input, styles.textArea, descriptionError && styles.inputError]}
              placeholder="Describe your item"
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                if (text.trim().length >= 10) setDescriptionError(false);
              }}
              onBlur={() => {
                if (!description.trim() || description.length < 10) setDescriptionError(true);
              }}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </Animated.View>
          
          <Animated.View 
            entering={FadeInUp.delay(600).springify()}
            style={[styles.inputContainer, styles.pickupAutocomplete]}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Pickup Location <Text style={styles.asterisk}>*</Text></Text>
              {pickupLocationError && <Text style={styles.errorText}>Required</Text>}
            </View>
            <View style={[styles.inputContainer, pickupLocationError && styles.inputError]}>
              <LocationAutocomplete
                placeholder="Where should the item be picked up?"
                value={pickupLocation}
                onChangeText={(text) => {
                  setPickupLocation(text);
                  if (text.trim()) setPickupLocationError(false);
                }}
                onClear={() => {
                  setPickupLocation('');
                  setPickupLocationError(true);
                }}
                onSelectLocation={(location) => {
                  console.log('Selected pickup location:', location);
                  setPickupLocation(location);
                  setPickupLocationError(false);
                }}
              />
            </View>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInUp.delay(700).springify()}
            style={[styles.inputContainer, styles.destinationAutocomplete]}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.label}>Destination <Text style={styles.asterisk}>*</Text></Text>
              {destinationError && <Text style={styles.errorText}>Required</Text>}
            </View>
            <View style={[styles.inputContainer, destinationError && styles.inputError]}>
              <LocationAutocomplete
                placeholder="Where should the item be delivered?"
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  if (text.trim()) setDestinationError(false);
                }}
                onClear={() => {
                  setDestination('');
                  setDestinationError(true);
                }}
                onSelectLocation={(location) => {
                  console.log('Selected destination:', location);
                  setDestination(location);
                  setDestinationError(false);
                }}
              />
            </View>
          </Animated.View>

          <Animated.View 
            entering={FadeInUp.delay(800).springify()}
            style={styles.sizeContainer}
          >
            <Text style={styles.label}>Item Size <Text style={styles.asterisk}>*</Text></Text>
            <View style={styles.sizeButtons}>
              {SIZE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sizeButton,
                    size === option.value && styles.sizeButtonActive,
                  ]}
                  onPress={() => setSize(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={size === option.value ? colors.white : colors.primary}
                  />
                  <Text
                    style={[
                      styles.sizeButtonText,
                      size === option.value && styles.sizeButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.sizeWeightText,
                      size === option.value && styles.sizeWeightTextActive,
                    ]}
                  >
                    {option.weightRange}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          <Animated.View 
            entering={FadeInUp.delay(900).springify()}
            style={styles.inputContainer}
          >
            <Text style={styles.label}>Item Image</Text>
            <TouchableOpacity onPress={pickImage} style={styles.imagePickerButton}>
              <Text style={styles.imagePickerButtonText}>Pick an image</Text>
            </TouchableOpacity>
            {image && <Image source={{ uri: image }} style={styles.imagePreview} />}
          </Animated.View>

          <TouchableOpacity
            style={[styles.postButton, { marginBottom: spacing.xl }]}
            onPress={() => {
              Keyboard.dismiss();
              if (validateForm()) {
                handlePostItem();
              } else {
                Alert.alert('Error', 'Please fill in all required fields correctly');
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.postButtonText}>Post Item</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
      
      <QuickFillModal
        visible={showQuickFillModal}
        onClose={() => setShowQuickFillModal(false)}
        onSelectItem={selectItemTemplate}
        items={SAMPLE_ITEMS}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  asterisk: {
    color: colors.error,
    fontWeight: 'bold',
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.xs,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: typography.sizes.md,
    ...shadows.small,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  sizeContainer: {
    marginBottom: spacing.xl,
  },
  sizeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sizeButton: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.small,
  },
  sizeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  sizeButtonTextActive: {
    color: colors.white,
  },
  sizeWeightText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  sizeWeightTextActive: {
    color: colors.white,
  },
  imagePickerButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  imagePickerButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
  },
  postButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  postButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
  },
  autocompleteContainer: {
    flex: 0,
    position: 'relative',
    zIndex: 2,
    elevation: Platform.OS === 'android' ? 2 : 0,
  },
  destinationAutocomplete: {
    zIndex: 10,
    elevation: Platform.OS === 'android' ? 10 : 0,
  },
  pickupAutocomplete: {
    zIndex: 20,
    elevation: Platform.OS === 'android' ? 20 : 0,
    marginBottom: 20,
  },
  locationInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: 12,
    zIndex: 3,
  },
  quickOptionsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  quickFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  quickFillText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 30,
    maxHeight: '80%',
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  itemTemplate: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 6,
    ...shadows.small,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  itemTemplateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTemplateTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: 8,
  },
  itemTemplateDescription: {
    color: colors.text.secondary,
    fontSize: typography.sizes.sm,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerButton: {
    padding: spacing.md,
  },
}); 