import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { uploadIdVerification } from '../lib/verification';
import { borderRadius, colors, shadows, spacing } from '../theme';

export default function IdVerificationScreen() {
  const navigation = useNavigation();
  const { session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera roll permissions to upload an ID image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setSelectedImage(result.assets[0].uri);
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera permissions to take an ID photo');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setSelectedImage(result.assets[0].uri);
    } catch (error: any) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleSubmitVerification = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an ID image first');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadIdVerification(session.user.id, selectedImage);
      
      if (result.success) {
        await refreshProfile();
        Alert.alert(
          'ID Verification Submitted',
          'Your ID has been submitted for verification. We will review it within 24-48 hours and notify you of the result.',
          [{ 
            text: 'OK', 
            onPress: () => navigation.goBack()
          }]
        );
      } else {
        throw new Error(result.error || 'Failed to submit ID verification');
      }
    } catch (error: any) {
      console.error('Error submitting ID verification:', error);
      Alert.alert('Error', error.message || 'Failed to submit ID verification');
    } finally {
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Select ID Image',
      'Choose how you want to add your ID image',
      [
        { text: 'Camera', onPress: handleCameraCapture },
        { text: 'Photo Library', onPress: handleImagePick },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, '#4A90E2']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ID Verification</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* ID Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="card" size={80} color={colors.primary} />
        </View>

        {/* Title and Description */}
        <Text style={styles.title}>Verify Your Identity</Text>
        <Text style={styles.description}>
          Upload a clear photo of your government-issued ID to verify your identity and increase your trust score.
        </Text>

        {/* Accepted Documents */}
        <View style={styles.documentsContainer}>
          <Text style={styles.documentsTitle}>Accepted Documents:</Text>
          <View style={styles.documentItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.documentText}>Driver's License</Text>
          </View>
          <View style={styles.documentItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.documentText}>Passport</Text>
          </View>
          <View style={styles.documentItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.documentText}>National ID Card</Text>
          </View>
          <View style={styles.documentItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.documentText}>State ID Card</Text>
          </View>
        </View>

        {/* Image Upload Section */}
        <View style={styles.uploadContainer}>
          <Text style={styles.uploadTitle}>Upload ID Image</Text>
          
          {selectedImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={showImageOptions}
              >
                <Ionicons name="camera" size={20} color={colors.primary} />
                <Text style={styles.changeImageText}>Change Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={showImageOptions}
            >
              <Ionicons name="camera" size={40} color={colors.text.secondary} />
              <Text style={styles.uploadButtonText}>Tap to add ID image</Text>
              <Text style={styles.uploadSubtext}>Camera or Photo Library</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesContainer}>
          <Text style={styles.guidelinesTitle}>Photo Guidelines:</Text>
          <Text style={styles.guidelineText}>
            • Ensure the entire ID is visible{'\n'}
            • Use good lighting - avoid shadows{'\n'}
            • Keep the image clear and in focus{'\n'}
            • Make sure all text is readable{'\n'}
            • Avoid glare or reflections
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (!selectedImage || uploading) && styles.submitButtonDisabled]}
          onPress={handleSubmitVerification}
          disabled={!selectedImage || uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>Submit for Verification</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityContainer}>
          <Ionicons name="shield-checkmark" size={24} color="#32CD32" />
          <Text style={styles.securityText}>
            Your ID information is encrypted and securely stored. We only use it for verification purposes and never share it with third parties.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  documentsContainer: {
    width: '100%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  documentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  documentText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  uploadContainer: {
    width: '100%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  uploadSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  imagePreviewContainer: {
    alignItems: 'center',
  },
  imagePreview: {
    width: 250,
    height: 180,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  changeImageText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  guidelinesContainer: {
    width: '100%',
    backgroundColor: '#FFF9E6',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
    marginBottom: spacing.xl,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  guidelineText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    width: '100%',
    ...shadows.small,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FFF0',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#32CD32',
  },
  securityText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
}); 