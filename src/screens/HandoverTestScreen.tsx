import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import HandoverCamera from '../components/HandoverCamera';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { didService } from '../services/DIDService';
import { HandoverService, PackageDetails } from '../services/HandoverService';
import { GPSCoordinates, locationService } from '../services/LocationService';
import { borderRadius, colors, shadows, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const HandoverTestScreen: React.FC = () => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [didStatus, setDidStatus] = useState<'loading' | 'exists' | 'missing'>('loading');
  const [userDID, setUserDID] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<'pickup' | 'delivery'>('pickup');
  const [testPackageQR, setTestPackageQR] = useState<string | null>(null);
  const [qrSignature, setQrSignature] = useState<string | null>(null);
  const [lastHandoverResult, setLastHandoverResult] = useState<any>(null);

  // Professional delivery package details
  const testPackage: PackageDetails = {
    packageId: 'PKG-SF-001',
    senderDID: userDID || 'test-sender-did',
    travelerDID: userDID || 'test-traveler-did',
    destination: 'San Francisco, CA',
    value: 50,
    expectedLocation: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10
    }
  };

  useEffect(() => {
    checkDIDStatus();
    getCurrentLocation();
  }, []);

  const checkDIDStatus = async () => {
    if (!user?.id) return;
    
    try {
      setDidStatus('loading');
      
      // Get user profile from Supabase to check for DID
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('did_identifier, public_key')
        .eq('id', user.id)
        .single();
      
      if (!error && userProfile?.did_identifier) {
        setDidStatus('exists');
        setUserDID(userProfile.did_identifier);
        console.log('✅ DID found in profile:', userProfile.did_identifier);
        return;
      }
      
      // If no DID in profile, check if user has DID key pair stored locally
      const hasKeyPair = await didService.hasDIDKeyPair(user.id);
      
      if (hasKeyPair) {
        const keyPair = await didService.retrieveDIDKeyPair(user.id);
        if (keyPair) {
          setDidStatus('exists');
          setUserDID(keyPair.did);
          console.log('✅ DID found in keychain:', keyPair.did);
          return;
        }
      }
      
      console.log('❌ No DID found for user');
      setDidStatus('missing');
    } catch (error) {
      console.error('Error checking DID status:', error);
      setDidStatus('missing');
    }
  };

  const getCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    setCurrentLocation(location);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkDIDStatus();
    await getCurrentLocation();
    setRefreshing(false);
  };

  const generatePackageQR = async () => {
    if (!userDID || !user?.id) {
      Alert.alert('Verification Required', 'Please create your digital identity first');
      return;
    }

    try {
      const handoverService = HandoverService.getInstance();
      const qrResult = await handoverService.generatePackageQR(testPackage, user.id);
      
      setTestPackageQR(qrResult.qrData);
      setQrSignature(qrResult.signature);
      
      Alert.alert(
        'Package QR Generated',
        'Secure package verification code created with cryptographic signature',
        [{ text: 'Continue', style: 'default' }]
      );
    } catch (error) {
      console.error('Error generating QR:', error);
      Alert.alert('Generation Failed', 'Unable to create package verification code. Please try again.');
    }
  };

  const initiatePickupVerification = () => {
    if (!userDID || !user?.id) {
      Alert.alert('Verification Required', 'Please create your digital identity first');
      return;
    }
    setCameraType('pickup');
    setShowCamera(true);
  };

  const initiateDeliveryConfirmation = () => {
    if (!userDID || !user?.id) {
      Alert.alert('Verification Required', 'Please create your digital identity first');
      return;
    }
    setCameraType('delivery');
    setShowCamera(true);
  };

  const handleVerificationCapture = async (photoUri: string, location: GPSCoordinates) => {
    try {
      const handoverService = HandoverService.getInstance();
      let result;

      if (cameraType === 'pickup') {
        result = await handoverService.verifyPickup(testPackage, user!.id);
        
        if (result.success) {
          Alert.alert(
            'Pickup Verified',
            `Package pickup successfully verified!\n\nLocation Accuracy: ${result.distance}m\nVerification: ${result.verified ? 'Confirmed' : 'Manual Override'}\nSignature: ${result.signature?.substring(0, 16)}...`,
            [{ text: 'Continue', style: 'default' }]
          );
        }
      } else {
        result = await handoverService.verifyDelivery(testPackage, user!.id);
        
        if (result.success) {
          // The service already shows the success alert
          console.log('Delivery verification completed successfully');
        }
      }

      setLastHandoverResult(result);
      setShowCamera(false);
      
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Verification Failed', 'Unable to process handover verification. Please try again.');
      setShowCamera(false);
    }
  };

  const createDigitalIdentity = async () => {
    if (!user?.id) return;
    
    try {
      Alert.alert(
        'Create Digital Identity',
        'This will create your secure blockchain-based identity for package verification',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Create', 
            onPress: async () => {
              const result = await didService.createDIDForUser(user.id);
              if (result.success) {
                Alert.alert('Success', 'Your digital identity has been created');
                await checkDIDStatus();
              } else {
                Alert.alert('Error', result.error || 'Failed to create digital identity');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating digital identity:', error);
      Alert.alert('Error', 'Failed to create digital identity');
    }
  };

  if (showCamera) {
    return (
      <HandoverCamera
        expectedLocation={currentLocation || testPackage.expectedLocation}
        onCapture={handleVerificationCapture}
        onCancel={() => setShowCamera(false)}
        type={cameraType}
        packageTitle="Professional Package Delivery"
      />
    );
  }

  const getDIDStatusInfo = () => {
    switch (didStatus) {
      case 'loading':
        return { color: colors.warning, text: 'Checking verification status...', icon: 'hourglass-outline' };
      case 'exists':
        return { color: colors.success, text: 'Identity Verified', icon: 'checkmark-circle' };
      case 'missing':
        return { color: colors.error, text: 'Identity Required', icon: 'warning' };
    }
  };

  const statusInfo = getDIDStatusInfo();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SkyPort Delivery Verification</Text>
        <Text style={styles.subtitle}>
          Secure blockchain-powered handover system with GPS + Photo + DID verification
        </Text>
      </View>

      {/* Digital Identity Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
          <Text style={styles.cardTitle}>Digital Identity Status</Text>
        </View>
        
        <Text style={[styles.statusText, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Text>
        
        {userDID && (
          <Text style={styles.didText}>
            {userDID.substring(0, 20)}...{userDID.substring(userDID.length - 8)}
          </Text>
        )}
        
        {didStatus === 'missing' && (
          <TouchableOpacity style={styles.button} onPress={createDigitalIdentity}>
            <Text style={styles.buttonText}>Create Digital Identity</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Current Location */}
      {currentLocation && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Current Location</Text>
          </View>
          
          <Text style={styles.locationText}>
            📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
          
          {currentLocation.accuracy && (
            <Text style={styles.accuracyText}>
              Accuracy: ±{Math.round(currentLocation.accuracy)}m
            </Text>
          )}
        </View>
      )}

      {/* Package Verification Code */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="qr-code" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Package Verification Code</Text>
        </View>
        
        {testPackageQR ? (
          <View style={styles.qrContainer}>
            <QRCode
              value={testPackageQR}
              size={150}
              backgroundColor="white"
              color="black"
            />
            <Text style={styles.qrText}>Package PKG-SF-001</Text>
            {qrSignature && (
              <Text style={styles.signatureText}>
                🔐 Secured: {qrSignature.substring(0, 16)}...
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.button, { opacity: didStatus === 'exists' ? 1 : 0.5 }]} 
            onPress={generatePackageQR}
            disabled={didStatus !== 'exists'}
          >
            <Text style={styles.buttonText}>Generate Verification Code</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Handover Verification */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Secure Handover Verification</Text>
        </View>
        
        <Text style={styles.verificationIntro}>
          Professional package verification with GPS location, photo evidence, and cryptographic signatures.
        </Text>
        
        <View style={styles.verificationButtons}>
          <TouchableOpacity 
            style={[styles.verificationButton, styles.pickupButton, { opacity: didStatus === 'exists' ? 1 : 0.5 }]}
            onPress={initiatePickupVerification}
            disabled={didStatus !== 'exists'}
          >
            <Ionicons name="arrow-up-circle" size={32} color={colors.white} />
            <Text style={styles.verificationButtonText}>Verify Pickup</Text>
            <Text style={styles.verificationButtonSubtext}>GPS + Photo + Digital Signature</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.verificationButton, styles.deliveryButton, { opacity: didStatus === 'exists' ? 1 : 0.5 }]}
            onPress={initiateDeliveryConfirmation}
            disabled={didStatus !== 'exists'}
          >
            <Ionicons name="arrow-down-circle" size={32} color={colors.white} />
            <Text style={styles.verificationButtonText}>Confirm Delivery</Text>
            <Text style={styles.verificationButtonSubtext}>Instant Payment Release</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Verification Result */}
      {lastHandoverResult && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons 
              name={lastHandoverResult.success ? "checkmark-circle" : "close-circle"} 
              size={24} 
              color={lastHandoverResult.success ? colors.success : colors.error} 
            />
            <Text style={styles.cardTitle}>Verification Result</Text>
          </View>
          
          <Text style={[styles.resultText, { 
            color: lastHandoverResult.success ? colors.success : colors.error 
          }]}>
            {lastHandoverResult.success ? '✅ Verification Successful' : '❌ Verification Failed'}
          </Text>
          
          <Text style={styles.resultDetail}>
            Location Accuracy: {lastHandoverResult.distance}m
          </Text>
          
          <Text style={styles.resultDetail}>
            Status: {lastHandoverResult.verified ? 'Location Verified' : 'Manual Override'}
          </Text>
          
          {lastHandoverResult.error && (
            <Text style={styles.errorText}>Error: {lastHandoverResult.error}</Text>
          )}
        </View>
      )}

      {/* System Features */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>Security Features</Text>
        </View>
        
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>🔐 Blockchain-based digital identity</Text>
          <Text style={styles.featureItem}>📍 GPS location verification (50m accuracy)</Text>
          <Text style={styles.featureItem}>📸 Photo evidence with metadata</Text>
          <Text style={styles.featureItem}>✍️ Cryptographic digital signatures</Text>
          <Text style={styles.featureItem}>⚡ Instant automated payment release</Text>
          <Text style={styles.featureItem}>🛡️ Anti-fraud protection measures</Text>
          <Text style={styles.featureItem}>📱 Professional mobile interface</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  didText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
  },
  locationText: {
    fontSize: 14,
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  accuracyText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  qrContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  signatureText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  verificationIntro: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  verificationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  verificationButton: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  pickupButton: {
    backgroundColor: colors.primary,
  },
  deliveryButton: {
    backgroundColor: colors.success,
  },
  verificationButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  verificationButtonSubtext: {
    color: colors.white,
    fontSize: 12,
    opacity: 0.8,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  resultDetail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: spacing.sm,
  },
  featureList: {
    gap: spacing.sm,
  },
  featureItem: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
}); 