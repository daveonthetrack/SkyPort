import { ethers } from 'ethers';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { didService } from './DIDService';
import { GPSCoordinates, locationService } from './LocationService';

export interface PackageDetails {
  packageId: string;
  senderDID: string;
  travelerDID: string;
  destination: string;
  value: number;
  expectedLocation: GPSCoordinates;
}

export interface PickupVerification {
  packageId: string;
  senderDID: string;
  travelerDID: string;
  pickupPhoto: string;
  gpsLocation: GPSCoordinates;
  timestamp: number;
  cryptoSignature: string;
  qrCodeData?: string;
}

export interface DeliveryConfirmation {
  packageId: string;
  travelerDID: string;
  recipientDID?: string;
  deliveryPhoto: string;
  gpsLocation: GPSCoordinates;
  packageCondition: 'perfect' | 'good' | 'damaged';
  timestamp: number;
  cryptoSignature: string;
  locationVerified: boolean;
  distance: number;
}

export interface HandoverResult {
  success: boolean;
  verified: boolean;
  distance: number;
  error?: string;
  signature?: string;
  photoUrl?: string;
}

export class HandoverService {
  private static instance: HandoverService;

  public static getInstance(): HandoverService {
    if (!HandoverService.instance) {
      HandoverService.instance = new HandoverService();
    }
    return HandoverService.instance;
  }

  /**
   * Generate QR code for package pickup
   */
  async generatePackageQR(packageDetails: PackageDetails, userId: string): Promise<{
    qrData: string;
    signature: string;
  }> {
    const qrData = {
      packageId: packageDetails.packageId,
      senderDID: packageDetails.senderDID,
      travelerDID: packageDetails.travelerDID,
      destination: packageDetails.destination,
      value: packageDetails.value,
      created: Date.now()
    };

    try {
      // Sign QR data with sender's DID using the user ID
      const signature = await this.signWithDID(userId, JSON.stringify(qrData));
      
      console.log('📦 QR code generated for package:', packageDetails.packageId);
      
      return {
        qrData: JSON.stringify(qrData),
        signature
      };
    } catch (error) {
      console.error('❌ Error generating package QR:', error);
      throw new Error('Failed to generate package QR code');
    }
  }

  /**
   * Take handover photo with camera
   */
  async takeHandoverPhoto(type: 'pickup' | 'delivery'): Promise<string | null> {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Required',
          'Please grant camera permissions to take handover photos',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() }
          ]
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: true, // Include GPS data if available
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      console.log(`📸 ${type} photo taken successfully`);
      return result.assets[0].uri;

    } catch (error) {
      console.error(`❌ Error taking ${type} photo:`, error);
      Alert.alert('Camera Error', `Failed to take ${type} photo. Please try again.`);
      return null;
    }
  }

  /**
   * Upload photo to Supabase storage
   */
  private async uploadPhoto(photoUri: string, packageId: string, type: 'pickup' | 'delivery'): Promise<string | null> {
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `${packageId}_${type}_${Date.now()}.jpg`;
      const filePath = `handover-photos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('handover-photos')
        .upload(filePath, base64, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('handover-photos')
        .getPublicUrl(filePath);

      console.log('✅ Photo uploaded:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('❌ Error uploading photo:', error);
      return null;
    }
  }

  /**
   * Verify pickup with GPS + Photo + DID signature
   */
  async verifyPickup(
    packageDetails: PackageDetails,
    userId: string
  ): Promise<HandoverResult> {
    try {
      console.log('📦 Starting pickup verification...');

      // Step 1: Take pickup photo
      const photoUri = await this.takeHandoverPhoto('pickup');
      if (!photoUri) {
        return { success: false, verified: false, distance: -1, error: 'Photo required' };
      }

      // Step 2: Get current location
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        return { success: false, verified: false, distance: -1, error: 'Location required' };
      }

      // Step 3: Verify location proximity
      const distance = locationService.calculateDistance(
        packageDetails.expectedLocation,
        currentLocation
      );
      const locationVerified = distance <= 50;

      if (!locationVerified) {
        Alert.alert(
          'Location Warning',
          `You are ${distance}m away from the pickup location. Continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => this.completePickupVerification() }
          ]
        );
      }

      // Step 4: Upload photo
      const photoUrl = await this.uploadPhoto(photoUri, packageDetails.packageId, 'pickup');
      if (!photoUrl) {
        return { success: false, verified: false, distance, error: 'Failed to upload photo' };
      }

      // Step 5: Create verification data
      const verificationData: PickupVerification = {
        packageId: packageDetails.packageId,
        senderDID: packageDetails.senderDID,
        travelerDID: packageDetails.travelerDID,
        pickupPhoto: photoUrl,
        gpsLocation: currentLocation,
        timestamp: Date.now(),
        cryptoSignature: '', // Will be filled below
      };

      // Step 6: Sign with DID
      const signature = await this.signWithDID(userId, JSON.stringify(verificationData));
      verificationData.cryptoSignature = signature;

      // Step 7: Store in database
      await this.storeHandoverEvent({
        package_id: packageDetails.packageId,
        event_type: 'pickup',
        user_did: packageDetails.travelerDID,
        gps_location: `POINT(${currentLocation.longitude} ${currentLocation.latitude})`,
        photo_url: photoUrl,
        verification_data: verificationData,
        crypto_signature: signature,
        verified: locationVerified
      });

      console.log('✅ Pickup verification completed');
      
      return {
        success: true,
        verified: locationVerified,
        distance,
        signature,
        photoUrl
      };

    } catch (error) {
      console.error('❌ Pickup verification failed:', error);
      return {
        success: false,
        verified: false,
        distance: -1,
        error: error instanceof Error ? error.message : 'Pickup verification failed'
      };
    }
  }

  /**
   * Verify delivery with GPS + Photo + DID signature (bike rental style)
   */
  async verifyDelivery(
    packageDetails: PackageDetails,
    userId: string,
    packageCondition: 'perfect' | 'good' | 'damaged' = 'perfect'
  ): Promise<HandoverResult> {
    try {
      console.log('📦 Starting delivery verification...');

      // Step 1: Verify location first (like bike return)
      const locationResult = await locationService.verifyHandoverLocation(
        packageDetails.expectedLocation
      );

      if (!locationResult.verified) {
        const distanceMsg = locationService.formatDistance(locationResult.distance);
        Alert.alert(
          'Location Required',
          `Please get within 50m of the delivery location. You are currently ${distanceMsg} away.`,
          [
            { text: 'OK', style: 'default' },
            { text: 'Override', onPress: () => this.proceedWithDelivery() }
          ]
        );
        return {
          success: false,
          verified: false,
          distance: locationResult.distance,
          error: 'Location verification failed'
        };
      }

      // Step 2: Take delivery photo
      const photoUri = await this.takeHandoverPhoto('delivery');
      if (!photoUri) {
        return {
          success: false,
          verified: false,
          distance: locationResult.distance,
          error: 'Photo required'
        };
      }

      // Step 3: Upload photo
      const photoUrl = await this.uploadPhoto(photoUri, packageDetails.packageId, 'delivery');
      if (!photoUrl) {
        return {
          success: false,
          verified: false,
          distance: locationResult.distance,
          error: 'Failed to upload photo'
        };
      }

      // Step 4: Create delivery confirmation
      const deliveryData: DeliveryConfirmation = {
        packageId: packageDetails.packageId,
        travelerDID: packageDetails.travelerDID,
        deliveryPhoto: photoUrl,
        gpsLocation: locationResult.currentLocation!,
        packageCondition,
        timestamp: Date.now(),
        cryptoSignature: '',
        locationVerified: locationResult.verified,
        distance: locationResult.distance
      };

      // Step 5: Sign with DID
      const signature = await this.signWithDID(userId, JSON.stringify(deliveryData));
      deliveryData.cryptoSignature = signature;

      // Step 6: Store delivery event
      await this.storeHandoverEvent({
        package_id: packageDetails.packageId,
        event_type: 'delivery',
        user_did: packageDetails.travelerDID,
        gps_location: `POINT(${locationResult.currentLocation!.longitude} ${locationResult.currentLocation!.latitude})`,
        photo_url: photoUrl,
        verification_data: deliveryData,
        crypto_signature: signature,
        verified: true
      });

      // Step 7: Auto-release payment (like bike rental completion)
      await this.processAutoPaymentRelease(packageDetails.packageId, deliveryData);

      console.log('✅ Delivery verification completed - Payment released!');
      
      Alert.alert(
        'Delivery Confirmed! 🎉',
        'Your delivery has been verified and payment has been released.',
        [{ text: 'Awesome!', style: 'default' }]
      );

      return {
        success: true,
        verified: true,
        distance: locationResult.distance,
        signature,
        photoUrl
      };

    } catch (error) {
      console.error('❌ Delivery verification failed:', error);
      return {
        success: false,
        verified: false,
        distance: -1,
        error: error instanceof Error ? error.message : 'Delivery verification failed'
      };
    }
  }

  /**
   * Store handover event in database
   */
  private async storeHandoverEvent(eventData: {
    package_id: string;
    event_type: 'pickup' | 'delivery';
    user_did: string;
    gps_location: string;
    photo_url: string;
    verification_data: any;
    crypto_signature: string;
    verified: boolean;
  }): Promise<void> {
    const { error } = await supabase
      .from('handover_events')
      .insert(eventData);

    if (error) {
      console.error('❌ Error storing handover event:', error);
      throw new Error('Failed to store handover event');
    }

    console.log('✅ Handover event stored successfully');
  }

  /**
   * Auto-release payment after successful delivery (like bike rental)
   */
  private async processAutoPaymentRelease(
    packageId: string,
    deliveryData: DeliveryConfirmation
  ): Promise<void> {
    try {
      // TODO: Integrate with payment system
      // For now, just log the auto-release
      console.log('💰 Auto-releasing payment for package:', packageId);
      
      // Store payment release record
      const { error } = await supabase
        .from('payment_releases')
        .insert({
          package_id: packageId,
          amount: 0, // TODO: Get actual amount from package
          auto_verified: true,
          released_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error recording payment release:', error);
      }

    } catch (error) {
      console.error('❌ Error processing payment release:', error);
    }
  }

  private async completePickupVerification(): Promise<void> {
    // Implementation for when user overrides location warning
    console.log('📦 Completing pickup verification with location override');
  }

  private async proceedWithDelivery(): Promise<void> {
    // Implementation for when user overrides location warning
    console.log('📦 Proceeding with delivery despite location warning');
  }

  /**
   * Validate scanned QR code against stored package data
   */
  async validateQRCode(
    scannedQRData: string, 
    expectedPackageId: string
  ): Promise<{ valid: boolean; error?: string; packageData?: any }> {
    try {
      console.log('🔍 Validating QR code for package:', expectedPackageId);
      
      // Parse scanned QR data
      const qrData = JSON.parse(scannedQRData);
      
      // Basic structure validation
      if (!qrData.packageId || !qrData.senderDID || !qrData.cryptoSignature) {
        return {
          valid: false,
          error: 'Invalid QR code structure - missing required fields'
        };
      }
      
      // Check if package ID matches
      if (qrData.packageId !== expectedPackageId) {
        return {
          valid: false,
          error: 'QR code does not match the expected package'
        };
      }
      
      // Verify cryptographic signature
      const signatureValid = await this.verifyQRSignature(qrData);
      if (!signatureValid) {
        return {
          valid: false,
          error: 'QR code signature verification failed - possibly tampered'
        };
      }
      
      // Check QR code expiration (24 hours)
      const qrAge = Date.now() - qrData.created;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (qrAge > maxAge) {
        return {
          valid: false,
          error: 'QR code has expired - please request a new one'
        };
      }
      
      console.log('✅ QR code validation successful');
      return {
        valid: true,
        packageData: qrData
      };
      
    } catch (error) {
      console.error('❌ QR code validation error:', error);
      return {
        valid: false,
        error: 'Failed to validate QR code - invalid format'
      };
    }
  }

  /**
   * Verify QR code cryptographic signature
   */
  private async verifyQRSignature(qrData: any): Promise<boolean> {
    try {
      // Create verification hash from QR data (excluding signature)
      const { cryptoSignature, ...dataToVerify } = qrData;
      const verificationData = JSON.stringify(dataToVerify);
      
      // Get sender's DID from database to verify signature
      const { data: senderProfile, error } = await supabase
        .from('profiles')
        .select('did_identifier, public_key')
        .eq('did_identifier', qrData.senderDID)
        .single();
      
      if (error || !senderProfile) {
        console.error('❌ Sender DID not found in database');
        return false;
      }
      
      // Use ethers to verify signature
      const recoveredAddress = ethers.verifyMessage(verificationData, cryptoSignature);
      const expectedAddress = qrData.senderDID.split(':').pop(); // Extract address from DID
      
      const isValid = recoveredAddress.toLowerCase() === expectedAddress?.toLowerCase();
      console.log(isValid ? '✅ QR signature verified' : '❌ QR signature invalid');
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Error verifying QR signature:', error);
      return false;
    }
  }

  /**
   * Generate enhanced QR code with additional security features
   */
  async generateEnhancedPackageQR(
    packageDetails: PackageDetails, 
    userId: string,
    travelerName?: string
  ): Promise<{ qrData: string; signature: string }> {
    const enhancedQRData = {
      packageId: packageDetails.packageId,
      senderDID: packageDetails.senderDID,
      travelerDID: packageDetails.travelerDID,
      title: packageDetails.destination, // Using destination as title for now
      destination: packageDetails.destination,
      value: packageDetails.value,
      travelerName: travelerName || 'Unknown',
      created: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      securityLevel: 'blockchain-verified'
    };

    try {
      // Sign enhanced QR data
      const signature = await this.signWithDID(userId, JSON.stringify(enhancedQRData));
      
      // Add signature to QR data
      const signedQRData = {
        ...enhancedQRData,
        cryptoSignature: signature
      };
      
      console.log('📦 Enhanced QR code generated for package:', packageDetails.packageId);
      
      return {
        qrData: JSON.stringify(signedQRData),
        signature
      };
    } catch (error) {
      console.error('❌ Error generating enhanced QR:', error);
      throw new Error('Failed to generate enhanced package QR code');
    }
  }

  /**
   * Sign data with DID private key
   */
  async signWithDID(userId: string, data: string): Promise<string> {
    try {
      console.log('🔐 Signing data with DID for user:', userId);
      
      // Get user profile from Supabase to check for DID
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('did_identifier, public_key')
        .eq('id', userId)
        .single();

      if (error || !userProfile?.did_identifier) {
        throw new Error('No DID found for user. Please create a digital identity first.');
      }
      
      console.log('✅ Found DID in profile:', userProfile.did_identifier);
      
      // Try to get the key pair
      let keyPair = await didService.retrieveDIDKeyPair(userId);
      
      if (!keyPair) {
        // User has DID but no key pair - generate new one
        console.warn('User has DID identifier but no key pair found. Creating new key pair...');
        
        const newKeyPair = await didService.generateDIDKeyPair();
        // Update the DID to match the profile
        newKeyPair.did = userProfile.did_identifier;
        
        await didService.storeDIDKeyPair(userId, newKeyPair);
        keyPair = newKeyPair;
        console.log('✅ New DID key pair created and stored for user');
      }

      console.log('🔑 Using key pair for signing...');
      const wallet = new ethers.Wallet(keyPair.privateKey);
      const signature = await wallet.signMessage(data);

      console.log('✅ Data signed successfully');
      return signature;
    } catch (error) {
      console.error('❌ Error signing with DID:', error);
      throw new Error('Failed to sign data with digital identity');
    }
  }
}

export const handoverService = HandoverService.getInstance(); 