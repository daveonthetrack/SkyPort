import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { HomeStackParamList, TabParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { NotificationService } from '../services/NotificationService';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

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

// Add common travel routes
const popularRoutes = [
  { id: '1', origin: 'New York, USA', destination: 'London, UK', isInternational: true },
  { id: '2', origin: 'Los Angeles, USA', destination: 'Toronto, Canada', isInternational: true },
  { id: '3', origin: 'Chicago, USA', destination: 'Miami, USA', isInternational: false },
  { id: '4', origin: 'San Francisco, USA', destination: 'Tokyo, Japan', isInternational: true },
  { id: '5', origin: 'Boston, USA', destination: 'Washington DC, USA', isInternational: false },
  { id: '6', origin: 'Seattle, USA', destination: 'Vancouver, Canada', isInternational: true },
  { id: '7', origin: 'Dallas, USA', destination: 'Mexico City, Mexico', isInternational: true },
  { id: '8', origin: 'Houston, USA', destination: 'Las Vegas, USA', isInternational: false },
];

type PostTripScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, 'PostTrip'>,
  BottomTabNavigationProp<TabParamList>
>;

export const PostTripScreen = () => {
  const { profile } = useAuth();
  const navigation = useNavigation<PostTripScreenNavigationProp>();
  
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date());
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [capacity, setCapacity] = useState<'small' | 'medium' | 'large'>('medium');
  const [loading, setLoading] = useState(false);
  
  // Add trip type state - default to round trip
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip');
  
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [enableReminders, setEnableReminders] = useState(true);
  const [verifyTrip, setVerifyTrip] = useState(false);
  const [verificationImage, setVerificationImage] = useState<string | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<'ticket' | 'booking' | 'other'>('ticket');
  const [showVerificationOptions, setShowVerificationOptions] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Add validation states
  const [originError, setOriginError] = useState(false);
  const [destinationError, setDestinationError] = useState(false);
  
  // Add state for auto-fill modal
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [filterInternational, setFilterInternational] = useState(false);

  // Filter routes based on international preference
  const filteredRoutes = filterInternational 
    ? popularRoutes.filter(route => route.isInternational) 
    : popularRoutes;

  // Function to auto-fill a route
  const autoFillRoute = (route: typeof popularRoutes[0]) => {
    setOrigin(route.origin);
    setDestination(route.destination);
    setOriginError(false);
    setDestinationError(false);
    setShowAutoFillModal(false);
  };

  // Validate and update field errors
  const validateForm = () => {
    let isValid = true;
    
    if (!origin.trim()) {
      setOriginError(true);
      isValid = false;
    } else {
      setOriginError(false);
    }
    
    if (!destination.trim()) {
      setDestinationError(true);
      isValid = false;
    } else {
      setDestinationError(false);
    }
    
    return isValid;
  };

  // Quick fill function for tomorrow
  const fillTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDepartureDate(tomorrow);
  };

  // Quick fill function for next week
  const fillNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDepartureDate(nextWeek);
  };

  // Quick fill function for return date (+3 days after departure)
  const fillReturnDate = () => {
    const returnDay = new Date(departureDate);
    returnDay.setDate(returnDay.getDate() + 3);
    setReturnDate(returnDay);
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateForDB = (date: Date | null) => {
    if (!date) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const handleDepartureDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || departureDate;
    setShowDeparturePicker(false);
    setDepartureDate(currentDate);
    
    // If return date is before the departure date, clear it
    if (returnDate && returnDate < currentDate) {
      setReturnDate(null);
    }
  };

  const handleReturnDateChange = (event: any, selectedDate?: Date) => {
    setShowReturnPicker(false);
    if (selectedDate) {
      setReturnDate(selectedDate);
    }
  };

  // Handle trip type change
  const handleTripTypeChange = (type: 'one-way' | 'round-trip') => {
    setTripType(type);
    // Clear return date if changing to one-way
    if (type === 'one-way') {
      setReturnDate(null);
    } else if (type === 'round-trip' && !returnDate) {
      // Set a default return date if changing to round-trip (3 days after departure)
      const returnDay = new Date(departureDate);
      returnDay.setDate(returnDay.getDate() + 3);
      setReturnDate(returnDay);
    }
  };

  const handlePostTrip = async () => {
    if (loading) return;
    
    if (!validateForm()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Make sure departure date is not in the past
    const now = new Date();
    if (departureDate < now) {
      Alert.alert('Error', 'Departure date cannot be in the past');
      return;
    }

    // Make sure return date is after departure date (only if round-trip)
    if (tripType === 'round-trip' && returnDate && returnDate < departureDate) {
      Alert.alert('Error', 'Return date must be after departure date');
      return;
    }

    setLoading(true);
    try {
      // Insert trip into database
      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            user_id: profile?.id,
            origin,
            destination,
            departure_date: formatDateForDB(departureDate),
            return_date: tripType === 'round-trip' ? formatDateForDB(returnDate) : null,
            capacity,
            status: 'pending',
            notes,
            trip_type: tripType, // Add trip type to database
          },
        ])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        const tripId = data[0].id;
        
        // Schedule notifications if enabled
        if (enableReminders) {
          await NotificationService.scheduleTripReminders(
            profile?.id || '',
            tripId,
            departureDate.toISOString(),
            origin,
            destination
          );
        }

        Alert.alert(
          'Success', 
          'Trip posted successfully!',
          [
            { 
              text: 'View My Trips', 
              onPress: () => navigation.navigate('MyTrips', undefined)
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
        
        // Clear form
        setOrigin('');
        setDestination('');
        setDepartureDate(new Date());
        setReturnDate(null);
        setCapacity('medium');
        setNotes('');

        if (verifyTrip && verificationImage) {
          try {
            console.log('Uploading verification document...');
            
            // Generate a unique filename
            const fileName = `verification_${profile?.id}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            
            // Determine the file extension
            let fileExt = verificationImage.includes('.') ? verificationImage.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
            let contentType = 'image/jpeg';
            
            if (fileExt === 'png') contentType = 'image/png';
            if (fileExt === 'pdf') contentType = 'application/pdf';
            
            const filePath = `${fileName}.${fileExt}`;
            
            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(verificationImage, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            // Upload to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('verifications')
              .upload(filePath, decode(base64), {
                contentType,
                upsert: true
              });
              
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: publicUrlData } = supabase.storage
              .from('verifications')
              .getPublicUrl(filePath);
            
            const verificationUrl = publicUrlData.publicUrl;
            
            // Update trip with verification information
            const { error: updateError } = await supabase
              .from('trips')
              .update({
                is_verified: true,
                verification_url: verificationUrl,
                verification_type: verificationMethod,
                verification_date: new Date().toISOString()
              })
              .eq('id', tripId);
              
            if (updateError) throw updateError;
            
            console.log('Trip verification complete');
          } catch (verificationError) {
            console.error('Verification upload error:', verificationError);
            // Don't fail the entire trip creation, just the verification
            Alert.alert(
              'Verification Warning',
              'Your trip was created, but there was an issue uploading the verification document. You can try again later.'
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Error posting trip:', error);
      Alert.alert('Error', error.message || 'Failed to post trip');
    } finally {
      setLoading(false);
    }
  };

  // Fix the Auto-fill Modal Component
  const AutoFillModal = ({ 
    visible, 
    onClose, 
    onSelectRoute, 
    filterInternational, 
    onToggleFilter, 
    routes
  }: { 
    visible: boolean, 
    onClose: () => void, 
    onSelectRoute: (route: typeof popularRoutes[0]) => void, 
    filterInternational: boolean, 
    onToggleFilter: (value: boolean) => void, 
    routes: typeof popularRoutes 
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
            <Text style={styles.modalTitle}>Auto-Fill Routes</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterToggle}>
            <Text style={styles.filterLabel}>International Routes Only</Text>
            <Switch
              value={filterInternational}
              onValueChange={onToggleFilter}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={filterInternational ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <FlatList
            data={routes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.routeItem}
                onPress={() => onSelectRoute(item)}
              >
                <View style={styles.routeContent}>
                  <View style={styles.locationIcons}>
                    <Ionicons name="location-outline" size={18} color={colors.primary} />
                    <View style={styles.routeLine} />
                    <Ionicons name="location" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.routeDetails}>
                    <Text style={styles.routeOrigin}>{item.origin}</Text>
                    <Text style={styles.routeDestination}>{item.destination}</Text>
                  </View>
                </View>
                {item.isInternational && (
                  <View style={styles.internationalBadge}>
                    <Text style={styles.internationalText}>Int'l</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Add this function for picking verification documents
  const pickVerificationDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setVerificationImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Post New Trip</Text>
        <Text style={styles.subtitle}>Share your travel plans to carry items for others</Text>
        
        <View style={styles.quickFillContainer}>
          <TouchableOpacity 
            style={styles.quickFillButton}
            onPress={() => setShowAutoFillModal(true)}
          >
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text style={styles.quickFillText}>Quick Routes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickFillButton}
            onPress={fillTomorrow}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.quickFillText}>Tomorrow</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickFillButton}
            onPress={fillNextWeek}
          >
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={styles.quickFillText}>Next Week</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickFillButton}
            onPress={fillReturnDate}
          >
            <Ionicons name="repeat" size={16} color={colors.primary} />
            <Text style={styles.quickFillText}>+3 Days</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.formGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Origin <Text style={styles.asterisk}>*</Text></Text>
            {originError && <Text style={styles.requiredIndicator}>Required</Text>}
          </View>
          <View style={[
            styles.inputContainer,
            originError && styles.inputError
          ]}>
            <Ionicons 
              name="location-outline" 
              size={20} 
              color={originError ? colors.error : colors.text.secondary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.input}
              placeholder="City or Airport (e.g., New York, JFK)"
              value={origin}
              onChangeText={(text) => {
                setOrigin(text);
                if (text.trim()) setOriginError(false);
              }}
              onBlur={() => {
                if (!origin.trim()) setOriginError(true);
              }}
            />
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Destination <Text style={styles.asterisk}>*</Text></Text>
            {destinationError && <Text style={styles.requiredIndicator}>Required</Text>}
          </View>
          <View style={[
            styles.inputContainer,
            destinationError && styles.inputError
          ]}>
            <Ionicons name="location" size={20} color={destinationError ? colors.error : colors.text.secondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="City or Airport (e.g., London, LHR)"
              value={destination}
              onChangeText={(text) => {
                setDestination(text);
                if (text.trim()) setDestinationError(false);
              }}
              onBlur={() => {
                if (!destination.trim()) setDestinationError(true);
              }}
            />
          </View>
        </View>

        {/* Trip Type Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Trip Type</Text>
          <View style={styles.tripTypeContainer}>
            <TouchableOpacity
              style={[
                styles.tripTypeButton,
                tripType === 'one-way' && styles.tripTypeButtonActive,
              ]}
              onPress={() => handleTripTypeChange('one-way')}
            >
              <Ionicons
                name="arrow-forward"
                size={20}
                color={tripType === 'one-way' ? '#fff' : colors.text.primary}
              />
              <Text
                style={[
                  styles.tripTypeText,
                  tripType === 'one-way' && styles.tripTypeTextActive,
                ]}
              >
                One-way
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tripTypeButton,
                tripType === 'round-trip' && styles.tripTypeButtonActive,
              ]}
              onPress={() => handleTripTypeChange('round-trip')}
            >
              <Ionicons
                name="repeat"
                size={20}
                color={tripType === 'round-trip' ? '#fff' : colors.text.primary}
              />
              <Text
                style={[
                  styles.tripTypeText,
                  tripType === 'round-trip' && styles.tripTypeTextActive,
                ]}
              >
                Round-trip
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Departure Date</Text>
          <TouchableOpacity 
            style={styles.dateInputContainer}
            onPress={() => setShowDeparturePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
            <Text style={styles.dateText}>
              {formatDateForDisplay(departureDate)}
            </Text>
          </TouchableOpacity>
          
          {showDeparturePicker && (
            <DateTimePicker
              value={departureDate}
              mode="date"
              display="default"
              onChange={handleDepartureDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>
        
        {tripType === 'round-trip' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Return Date</Text>
            <TouchableOpacity 
              style={styles.dateInputContainer}
              onPress={() => setShowReturnPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
              <Text style={styles.dateText}>
                {returnDate ? formatDateForDisplay(returnDate) : 'Select a date'}
              </Text>
            </TouchableOpacity>
            
            {showReturnPicker && (
              <DateTimePicker
                value={returnDate || new Date(departureDate.getTime() + 86400000)} // Default to day after departure
                mode="date"
                display="default"
                onChange={handleReturnDateChange}
                minimumDate={departureDate}
              />
            )}
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Available Capacity</Text>
          <View style={styles.capacityButtons}>
            <TouchableOpacity
              style={[styles.capacityButton, capacity === 'small' && styles.capacityButtonActive]}
              onPress={() => setCapacity('small')}
            >
              <Ionicons 
                name="briefcase-outline" 
                size={20} 
                color={capacity === 'small' ? '#fff' : colors.text.primary} 
              />
              <Text style={[styles.capacityButtonText, capacity === 'small' && styles.capacityButtonTextActive]}>
                Small
              </Text>
              <Text style={[styles.capacitySubtext, capacity === 'small' && styles.capacitySubtextActive]}>
                &lt; 5 lbs
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.capacityButton, capacity === 'medium' && styles.capacityButtonActive]}
              onPress={() => setCapacity('medium')}
            >
              <Ionicons 
                name="briefcase" 
                size={20} 
                color={capacity === 'medium' ? '#fff' : colors.text.primary} 
              />
              <Text style={[styles.capacityButtonText, capacity === 'medium' && styles.capacityButtonTextActive]}>
                Medium
              </Text>
              <Text style={[styles.capacitySubtext, capacity === 'medium' && styles.capacitySubtextActive]}>
                5-10 lbs
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.capacityButton, capacity === 'large' && styles.capacityButtonActive]}
              onPress={() => setCapacity('large')}
            >
              <Ionicons 
                name="briefcase-sharp" 
                size={20} 
                color={capacity === 'large' ? '#fff' : colors.text.primary} 
              />
              <Text style={[styles.capacityButtonText, capacity === 'large' && styles.capacityButtonTextActive]}>
                Large
              </Text>
              <Text style={[styles.capacitySubtext, capacity === 'large' && styles.capacitySubtextActive]}>
                &gt; 10 lbs
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special requirements or information about your trip"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            numberOfLines={4}
          />
        </View>
        
        <View style={styles.switchContainer}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchLabel}>Enable Trip Reminders</Text>
              <Text style={styles.switchDescription}>
                Get notified about your upcoming trip and items to carry
              </Text>
            </View>
            <Switch
              value={enableReminders}
              onValueChange={setEnableReminders}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={enableReminders ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.switchRow}>
            <View style={styles.switchTextContainer}>
              <Text style={styles.switchLabel}>
                Verify Your Trip
                {verifyTrip && <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{marginLeft: 6}} />}
              </Text>
              <Text style={styles.switchDescription}>
                Verified trips appear more trustworthy to potential senders
              </Text>
            </View>
            <Switch
              value={verifyTrip}
              onValueChange={(value) => {
                setVerifyTrip(value);
                if (value) {
                  setShowVerificationOptions(true);
                } else {
                  setVerificationImage(null);
                }
              }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={verifyTrip ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {verifyTrip && (
          <View style={styles.verificationContainer}>
            <Text style={styles.verificationTitle}>Upload Verification</Text>
            
            <View style={styles.verificationTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.verificationTypeButton,
                  verificationMethod === 'ticket' && styles.verificationTypeActive
                ]}
                onPress={() => setVerificationMethod('ticket')}
              >
                <Ionicons
                  name="ticket-outline"
                  size={20}
                  color={verificationMethod === 'ticket' ? '#fff' : colors.text.primary}
                />
                <Text
                  style={[
                    styles.verificationTypeText,
                    verificationMethod === 'ticket' && styles.verificationTypeTextActive
                  ]}
                >
                  Ticket
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.verificationTypeButton,
                  verificationMethod === 'booking' && styles.verificationTypeActive
                ]}
                onPress={() => setVerificationMethod('booking')}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={verificationMethod === 'booking' ? '#fff' : colors.text.primary}
                />
                <Text
                  style={[
                    styles.verificationTypeText,
                    verificationMethod === 'booking' && styles.verificationTypeTextActive
                  ]}
                >
                  Booking
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.verificationTypeButton,
                  verificationMethod === 'other' && styles.verificationTypeActive
                ]}
                onPress={() => setVerificationMethod('other')}
              >
                <Ionicons
                  name="document-outline"
                  size={20}
                  color={verificationMethod === 'other' ? '#fff' : colors.text.primary}
                />
                <Text
                  style={[
                    styles.verificationTypeText,
                    verificationMethod === 'other' && styles.verificationTypeTextActive
                  ]}
                >
                  Other
                </Text>
              </TouchableOpacity>
            </View>
            
            {verificationImage ? (
              <View style={styles.verificationPreviewContainer}>
                <Image source={{ uri: verificationImage }} style={styles.verificationPreview} />
                <TouchableOpacity
                  style={styles.changeVerificationButton}
                  onPress={pickVerificationDocument}
                >
                  <Text style={styles.changeVerificationText}>Change Document</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickVerificationDocument}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                <Text style={styles.uploadButtonText}>
                  Upload {verificationMethod === 'ticket' ? 'Ticket' : 
                         verificationMethod === 'booking' ? 'Booking Confirmation' : 'Document'}
                </Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.verificationNote}>
              Your document will be kept private and only used to verify your trip.
            </Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => {
            // Run validation first
            if (validateForm()) {
              handlePostTrip();
            } else {
              // If validation fails, scroll to top to show errors
              Alert.alert('Error', 'Please fill in all required fields');
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="airplane" size={20} color="#fff" />
              <Text style={styles.buttonText}>Post Trip</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <AutoFillModal 
          visible={showAutoFillModal} 
          onClose={() => setShowAutoFillModal(false)} 
          onSelectRoute={autoFillRoute}
          filterInternational={filterInternational}
          onToggleFilter={setFilterInternational}
          routes={filteredRoutes}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
  },
  asterisk: {
    color: colors.error,
    fontWeight: 'bold',
  },
  requiredIndicator: {
    color: colors.error,
    fontSize: 12,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dateText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  capacityButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  capacityButton: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginHorizontal: 4,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  capacityButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  capacityButtonText: {
    color: colors.text.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  capacityButtonTextActive: {
    color: colors.white,
  },
  capacitySubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  capacitySubtextActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  switchContainer: {
    marginBottom: spacing.xl,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  quickFillContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickFillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.xs,
  },
  quickFillText: {
    color: colors.primary,
    fontSize: 12,
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
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
    color: colors.text.primary,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterLabel: {
    fontSize: 16,
    color: colors.text.primary,
  },
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeContent: {
    flexDirection: 'row',
    flex: 1,
  },
  locationIcons: {
    alignItems: 'center',
    marginRight: 12,
  },
  routeLine: {
    width: 1,
    height: 20,
    backgroundColor: colors.primary,
    marginVertical: 4,
  },
  routeDetails: {
    flex: 1,
  },
  routeOrigin: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 4,
  },
  routeDestination: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  internationalBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  internationalText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  tripTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tripTypeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    ...shadows.small,
  },
  tripTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tripTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.xs,
  },
  tripTypeTextActive: {
    color: colors.white,
  },
  verificationContainer: {
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  verificationTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  verificationTypeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    marginHorizontal: 3,
  },
  verificationTypeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  verificationTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 4,
  },
  verificationTypeTextActive: {
    color: colors.white,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  uploadButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  verificationPreviewContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  verificationPreview: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  changeVerificationButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  changeVerificationText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  verificationNote: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
}); 