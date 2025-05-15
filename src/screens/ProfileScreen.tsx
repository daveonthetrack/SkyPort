import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  Platform,
  Switch,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import * as Linking from 'expo-linking';
import { 
  sendVerificationEmail, 
  sendPhoneVerificationCode, 
  uploadIdVerification,
  getVerificationStatus,
  calculateTrustLevel,
  type VerificationStatus
} from '../lib/verification';

// Define trust level type
type TrustLevel = 'basic' | 'silver' | 'gold';

// Trust level badge component
const TrustBadge = ({ level }: { level: TrustLevel }) => {
  const getBadgeColor = () => {
    switch (level) {
      case 'gold': return '#FFD700';
      case 'silver': return '#C0C0C0';
      case 'basic':
      default: return '#CD7F32';
    }
  };

  const getBadgeIcon = () => {
    switch (level) {
      case 'gold': return 'shield-checkmark';
      case 'silver': return 'shield-half';
      case 'basic':
      default: return 'shield-outline';
    }
  };

  return (
    <View style={[styles.trustBadge, { backgroundColor: getBadgeColor() }]}>
      <Ionicons name={getBadgeIcon() as any} size={16} color="#FFFFFF" />
      <Text style={styles.trustBadgeText}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Text>
    </View>
  );
};

// Verification option component
const VerificationOption = ({ 
  title, 
  subtitle, 
  icon, 
  isVerified,
  onPress 
}: { 
  title: string; 
  subtitle: string; 
  icon: string; 
  isVerified: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.verificationOption} onPress={onPress}>
    <View style={styles.verificationIconContainer}>
      <Ionicons name={icon as any} size={24} color={colors.primary} />
    </View>
    <View style={styles.verificationText}>
      <View style={styles.verificationTitleRow}>
        <Text style={styles.verificationTitle}>{title}</Text>
        {isVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#32CD32" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : (
          <Text style={styles.notVerifiedText}>Not Verified</Text>
        )}
      </View>
      <Text style={styles.verificationSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [verificationModal, setVerificationModal] = useState(false);
  const [activeVerification, setActiveVerification] = useState<string>('');
  const [isTraveler, setIsTraveler] = useState(profile?.role === 'traveler');
  const [changingRole, setChangingRole] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    isEmailVerified: false,
    isPhoneVerified: false,
    isIdVerified: false,
    isSocialConnected: false,
    trustLevel: 0
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhoneNumber(profile.phone_number || '');
      setIsTraveler(profile.role === 'traveler');
    }
  }, [profile]);

  useEffect(() => {
    if (session?.user?.id) {
      loadVerificationStatus();
    }
  }, [session?.user?.id]);

  const loadVerificationStatus = async () => {
    if (!session?.user?.id) return;
    
    const status = await getVerificationStatus(session.user.id);
    setVerificationStatus(status);
  };

  const handleUpdateProfile = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload an image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled) {
        return;
      }

      if (!result.assets || !result.assets[0]) {
        Alert.alert('Error', 'No image selected');
        return;
      }

      await uploadImage(result.assets[0].uri);
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    try {
      setUploading(true);

      // Convert image to blob
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      const blob = await response.blob();

      // Generate unique filename
      const filename = `${session.user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error('Failed to upload image to storage');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) {
        console.error('Error updating profile with avatar:', updateError);
        throw new Error('Failed to update profile with new avatar');
      }

      await refreshProfile();
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error in uploadImage:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // Handle verification request
  const handleVerificationRequest = async (type: string) => {
    setActiveVerification(type);
    setVerificationModal(true);
  };

  // Handle phone verification
  const handlePhoneVerification = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    // Validate phone number format
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    if (!/^\+[1-9]\d{1,14}$/.test(formattedPhone)) {
      Alert.alert('Error', 'Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    Alert.alert(
      'Phone Verification',
      'We will send a verification code to your phone number.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setVerificationModal(false) },
        { 
          text: 'Continue', 
          onPress: async () => {
            try {
              setLoading(true);
              const result = await sendPhoneVerificationCode(formattedPhone);
              
              if (result.success) {
                navigation.navigate('PhoneVerification', { phoneNumber: formattedPhone });
                setVerificationModal(false);
              } else {
                throw new Error(result.error || 'Failed to send verification code');
              }
            } catch (error: any) {
              console.error('Error sending verification code:', error);
              Alert.alert('Error', error.message || 'Failed to send verification code');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle email verification
  const handleEmailVerification = async () => {
    if (!session?.user?.email) {
      Alert.alert('Error', 'No email address found');
      return;
    }
    
    try {
      setLoading(true);
      const result = await sendVerificationEmail(session.user.email);
      
      if (result.success) {
        Alert.alert(
          'Verification Email Sent',
          'Please check your email for verification instructions.',
          [{ text: 'OK', onPress: () => setVerificationModal(false) }]
        );
      } else {
        throw new Error(result.error || 'Failed to send verification email');
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      Alert.alert('Error', error.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  // Handle ID verification
  const handleIDVerification = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    Alert.alert(
      'ID Verification',
      'We need to verify your identity. This will help build trust with other users.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setVerificationModal(false) },
        { 
          text: 'Continue', 
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                setLoading(true);
                const uploadResult = await uploadIdVerification(
                  session.user.id,
                  result.assets[0].uri
                );

                if (uploadResult.success) {
                  Alert.alert(
                    'Success',
                    'Your ID verification has been submitted for review.',
                    [{ text: 'OK', onPress: () => setVerificationModal(false) }]
                  );
                  await loadVerificationStatus();
                } else {
                  throw new Error(uploadResult.error || 'Failed to upload ID verification');
                }
              }
            } catch (error: any) {
              console.error('Error uploading ID verification:', error);
              Alert.alert('Error', error.message || 'Failed to upload ID verification');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Handle social media connection
  const handleSocialConnection = () => {
    Alert.alert(
      'Connect Social Account',
      'Select a social account to connect:',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setVerificationModal(false) },
        { text: 'Facebook', onPress: () => connectSocialAccount('facebook') },
        { text: 'Google', onPress: () => connectSocialAccount('google') },
        { text: 'Twitter', onPress: () => connectSocialAccount('twitter') }
      ]
    );
  };

  const connectSocialAccount = async (provider: string) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    try {
      setLoading(true);
      // In a real app, you would integrate with OAuth
      // For now, we'll simulate it
      
      // Update profile flag for demo purposes
      await supabase
        .from('profiles')
        .update({ 
          is_social_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id);
        
      await refreshProfile();
      
      Alert.alert('Success', `${provider} account connected successfully!`);
      setVerificationModal(false);
    } catch (error: any) {
      console.error('Error connecting social account:', error);
      Alert.alert('Error', error.message || 'Failed to connect social account');
    } finally {
      setLoading(false);
    }
  };

  const renderVerificationModal = () => {
    let content;
    
    switch (activeVerification) {
      case 'phone':
        content = handlePhoneVerification;
        break;
      case 'email':
        content = handleEmailVerification;
        break;
      case 'social':
        content = handleSocialConnection;
        break;
      case 'id':
        content = handleIDVerification;
        break;
      default:
        content = () => setVerificationModal(false);
    }
    
    // Execute the appropriate function when modal is opened
    useEffect(() => {
      if (verificationModal && content) {
        content();
      }
    }, [verificationModal]);
    
    return null;
  };

  const getTrustLevel = (): TrustLevel => {
    const trustScore = profile?.trust_level || 0;
    if (trustScore >= 80) return 'gold';
    if (trustScore >= 50) return 'silver';
    return 'basic';
  };

  const getTrustPercentage = (): string => {
    const trustScore = profile?.trust_level || 0;
    if (trustScore >= 80) return '100%';
    if (trustScore >= 50) return '66%';
    return '33%';
  };

  const handleRoleToggle = (value: boolean) => {
    Alert.alert(
      'Change Role',
      `Are you sure you want to switch to ${value ? 'traveler' : 'sender'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => updateUserRole(value ? 'traveler' : 'sender') }
      ]
    );
  };

  const updateUserRole = async (role: 'sender' | 'traveler') => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    try {
      setChangingRole(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      await refreshProfile();
      setIsTraveler(role === 'traveler');
      
      Alert.alert(
        'Role Updated',
        `You are now in ${role} mode. The app will refresh to apply changes.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate to home screen
              navigation.navigate('MainApp');
            } 
          }
        ]
      );
    } catch (error: any) {
      console.error('Error updating role:', error);
      Alert.alert('Error', error.message || 'Failed to update role');
    } finally {
      setChangingRole(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleImagePick}
          disabled={uploading}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color={colors.white} />
            </View>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.profileNameContainer}>
          <Text style={styles.name}>{profile?.name}</Text>
          <TrustBadge level={getTrustLevel()} />
        </View>
        <Text style={styles.email}>{session?.user?.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile?.completed_deliveries || 0}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {profile?.is_phone_verified && profile?.is_email_verified ? '2/4' : 
             profile?.is_phone_verified || profile?.is_email_verified ? '1/4' : '0/4'}
          </Text>
          <Text style={styles.statLabel}>Verifications</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {getTrustPercentage()}
          </Text>
          <Text style={styles.statLabel}>Trust Score</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Switch Your Role</Text>
        
        <View style={styles.roleSelectionContainer}>
          <TouchableOpacity 
            style={[
              styles.roleButton, 
              !isTraveler && styles.activeRoleButton
            ]}
            onPress={() => handleRoleToggle(false)}
            disabled={changingRole || !isTraveler}
          >
            <Ionicons 
              name="cube-outline" 
              size={24} 
              color={!isTraveler ? '#FFFFFF' : colors.text.primary} 
            />
            <Text style={[
              styles.roleButtonText,
              !isTraveler && styles.activeRoleButtonText
            ]}>
              Sender
            </Text>
          </TouchableOpacity>
          
          <View style={styles.roleDivider}>
            <View style={styles.roleDividerLine} />
            <Text style={styles.roleDividerText}>or</Text>
            <View style={styles.roleDividerLine} />
          </View>
          
          <TouchableOpacity 
            style={[
              styles.roleButton, 
              isTraveler && styles.activeRoleButton
            ]}
            onPress={() => handleRoleToggle(true)}
            disabled={changingRole || isTraveler}
          >
            <Ionicons 
              name="airplane-outline" 
              size={24} 
              color={isTraveler ? '#FFFFFF' : colors.text.primary} 
            />
            <Text style={[
              styles.roleButtonText,
              isTraveler && styles.activeRoleButtonText
            ]}>
              Traveler
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.roleDescriptionBox}>
          <Text style={styles.roleDescriptionTitle}>
            Currently in {isTraveler ? 'Traveler' : 'Sender'} Mode
          </Text>
          <Text style={styles.roleDescriptionText}>
            {isTraveler 
              ? 'As a traveler, you can pick up and carry items for others, earning rewards for your deliveries.' 
              : 'As a sender, you can create items for travelers to carry to your desired destinations.'}
          </Text>
          
          {changingRole && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Switching roles...</Text>
            </View>
          )}
        </View>
        
        <View style={styles.roleInfoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.roleInfoText}>
            You can switch between roles at any time. Your account information and verification status will be maintained across roles.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Your phone number"
            keyboardType="phone-pad"
          />
        </View>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.updateButtonText}>Update Profile</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Verification</Text>
        <Text style={styles.verificationIntro}>
          Verify your account to build trust with other users. Each verification increases your trust level.
        </Text>
        
        <VerificationOption
          title="Phone Number"
          subtitle="Verify your phone number"
          icon="call-outline"
          isVerified={verificationStatus.isPhoneVerified}
          onPress={() => handleVerificationRequest('phone')}
        />
        
        <VerificationOption
          title="Email Address"
          subtitle="Verify your email address"
          icon="mail-outline"
          isVerified={verificationStatus.isEmailVerified}
          onPress={() => handleVerificationRequest('email')}
        />
        
        <VerificationOption
          title="Social Account"
          subtitle="Connect a social media account"
          icon="logo-facebook"
          isVerified={verificationStatus.isSocialConnected}
          onPress={() => handleVerificationRequest('social')}
        />
        
        <VerificationOption
          title="ID Verification"
          subtitle="Verify your identity with an ID"
          icon="card-outline"
          isVerified={verificationStatus.isIdVerified}
          onPress={() => handleVerificationRequest('id')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trust Levels</Text>
        
        <View style={styles.trustLevelCard}>
          <View style={styles.trustLevelHeader}>
            <Ionicons name="shield-outline" size={20} color="#CD7F32" />
            <Text style={styles.trustLevelTitle}>Basic</Text>
            {getTrustLevel() === 'basic' && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.trustLevelDescription}>
            New users start at this level. Limited to smaller items and lower value deliveries.
          </Text>
        </View>
        
        <View style={styles.trustLevelCard}>
          <View style={styles.trustLevelHeader}>
            <Ionicons name="shield-half" size={20} color="#C0C0C0" />
            <Text style={styles.trustLevelTitle}>Silver</Text>
            {getTrustLevel() === 'silver' && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.trustLevelDescription}>
            Complete 5 deliveries and verify your phone and email to reach this level. Unlock medium-value items.
          </Text>
        </View>
        
        <View style={styles.trustLevelCard}>
          <View style={styles.trustLevelHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#FFD700" />
            <Text style={styles.trustLevelTitle}>Gold</Text>
            {getTrustLevel() === 'gold' && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.trustLevelDescription}>
            Complete 20 deliveries and verify your ID to reach this level. No restrictions on items.
          </Text>
        </View>
      </View>

      {renderVerificationModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl + 40,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: spacing.md,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.white,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
    color: colors.white,
    marginRight: spacing.sm,
  },
  email: {
    fontSize: typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: 5,
    ...shadows.medium,
    elevation: 4,
  },
  statNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
  },
  updateButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  updateButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trustBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginLeft: 4,
  },
  verificationIntro: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  verificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  verificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  verificationText: {
    flex: 1,
  },
  verificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  verificationSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: typography.sizes.sm,
    color: '#32CD32',
    marginLeft: 4,
  },
  notVerifiedText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  trustLevelCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  trustLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  trustLevelTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  trustLevelDescription: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  currentBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  currentBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  roleSelectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  
  roleButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadows.small,
  },
  
  activeRoleButton: {
    backgroundColor: colors.primary,
  },
  
  roleButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  
  activeRoleButtonText: {
    color: '#FFFFFF',
  },
  
  roleDivider: {
    width: 40,
    alignItems: 'center',
  },
  
  roleDividerLine: {
    height: 1,
    width: 20,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  
  roleDividerText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  
  roleDescriptionBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: 'relative',
  },
  
  roleDescriptionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  
  roleDescriptionText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    fontWeight: '500',
  },
  
  roleInfoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  roleInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
}); 