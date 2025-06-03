import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { GPSCoordinates, locationService } from '../services/LocationService';
import { borderRadius, colors, shadows, spacing } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HandoverCameraProps {
  expectedLocation: GPSCoordinates;
  onCapture: (photoUri: string, location: GPSCoordinates) => void;
  onCancel: () => void;
  type: 'pickup' | 'delivery';
  packageTitle?: string;
}

export const HandoverCamera: React.FC<HandoverCameraProps> = ({
  expectedLocation,
  onCapture,
  onCancel,
  type,
  packageTitle
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [distance, setDistance] = useState<number>(-1);
  const [isWithinRange, setIsWithinRange] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<string>('Getting location...');
  
  const cameraRef = useRef<CameraView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission === null) {
      requestPermission();
    } else {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  useEffect(() => {
    getCurrentLocation();
    startLocationTracking();
    
    return () => {
      locationService.stopTracking();
    };
  }, []);

  useEffect(() => {
    if (currentLocation) {
      const newDistance = locationService.calculateDistance(expectedLocation, currentLocation);
      setDistance(newDistance);
      setIsWithinRange(newDistance <= 50);
      
      // Update location accuracy display
      const accuracyStatus = locationService.getAccuracyStatus(currentLocation.accuracy || null);
      setLocationAccuracy(accuracyStatus.description);
    }
  }, [currentLocation, expectedLocation]);

  useEffect(() => {
    // Pulse animation for location indicator
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulseAnimation());
    };
    
    pulseAnimation();
  }, []);

  const getCurrentLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
    }
  };

  const startLocationTracking = () => {
    locationService.startTracking((location) => {
      setCurrentLocation(location);
    });
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please wait for GPS location to be acquired.');
      return;
    }

    try {
      setCapturing(true);
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
      });

      console.log(`📸 ${type} photo captured successfully`);
      onCapture(photo.uri, currentLocation);
      
    } catch (error) {
      console.error(`Error taking ${type} photo:`, error);
      Alert.alert('Camera Error', 'Failed to take photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const formatDistance = (meters: number): string => {
    return locationService.formatDistance(meters);
  };

  const getLocationStatusColor = (): string => {
    if (distance <= 10) return '#4CAF50'; // Excellent
    if (distance <= 25) return '#8BC34A'; // Good  
    if (distance <= 50) return '#FFC107'; // Acceptable
    return '#FF5722'; // Too far
  };

  const getLocationMessage = (): string => {
    if (distance <= 10) return `Perfect! You're only ${formatDistance(distance)} away`;
    if (distance <= 25) return `Good location - ${formatDistance(distance)} away`;
    if (distance <= 50) return `Acceptable - ${formatDistance(distance)} away`;
    return `Please get closer - ${formatDistance(distance)} away`;
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>Requesting camera permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={colors.text.secondary} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Please grant camera permissions to take {type} photos
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => requestPermission()}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={styles.header}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
            <Ionicons name="close" size={28} color={colors.white} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {type === 'pickup' ? '📦 Package Pickup Verification' : '📦 Package Delivery Confirmation'}
            </Text>
            {packageTitle && (
              <Text style={styles.packageTitle}>{packageTitle}</Text>
            )}
          </View>
        </LinearGradient>

        {/* GPS Status Overlay */}
        <View style={styles.gpsOverlay}>
          <View style={[styles.gpsCard, { borderColor: getLocationStatusColor() }]}>
            <Animated.View style={[styles.gpsIndicator, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons 
                name={isWithinRange ? "location" : "location-outline"} 
                size={24} 
                color={getLocationStatusColor()} 
              />
            </Animated.View>
            
            <View style={styles.gpsInfo}>
              <Text style={[styles.gpsDistance, { color: getLocationStatusColor() }]}>
                {distance >= 0 ? formatDistance(distance) : 'Getting location...'}
              </Text>
              <Text style={styles.gpsMessage}>
                {distance >= 0 ? getLocationMessage() : 'Acquiring GPS signal...'}
              </Text>
              <Text style={styles.gpsAccuracy}>{locationAccuracy}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsOverlay}>
          <Text style={styles.instructionText}>
            {type === 'pickup' 
              ? 'Capture clear photo showing package and pickup verification'
              : 'Document package delivery at the destination location'
            }
          </Text>
        </View>

        {/* Bottom Controls */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomOverlay}
        >
          {/* Location Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: isWithinRange ? '100%' : `${Math.max(0, Math.min(100, (50 - distance) / 50 * 100))}%`,
                    backgroundColor: getLocationStatusColor()
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {isWithinRange ? 'Location verified - ready to proceed' : 'Move within 50m range to continue'}
            </Text>
          </View>

          {/* Capture Button */}
          <View style={styles.captureContainer}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                { 
                  opacity: cameraReady && currentLocation ? 1 : 0.5,
                  backgroundColor: isWithinRange ? colors.primary : colors.warning
                }
              ]}
              onPress={takePicture}
              disabled={!cameraReady || capturing || !currentLocation}
            >
              {capturing ? (
                <ActivityIndicator size="large" color={colors.white} />
              ) : (
                <Ionicons 
                  name="camera" 
                  size={32} 
                  color={colors.white} 
                />
              )}
            </TouchableOpacity>
            
            <Text style={styles.captureText}>
              {capturing 
                ? 'Processing verification...' 
                : isWithinRange 
                  ? `Verify ${type}` 
                  : 'Move closer to enable verification'
              }
            </Text>
          </View>
        </LinearGradient>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: '#FFFFFF',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    ...shadows.medium,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  packageTitle: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    marginTop: 4,
  },
  gpsOverlay: {
    position: 'absolute',
    top: 120,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
  },
  gpsCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    ...shadows.medium,
  },
  gpsIndicator: {
    marginRight: spacing.md,
  },
  gpsInfo: {
    flex: 1,
  },
  gpsDistance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gpsMessage: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  gpsAccuracy: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  instructionsOverlay: {
    position: 'absolute',
    top: '50%',
    left: spacing.lg,
    right: spacing.lg,
    transform: [{ translateY: -20 }],
    zIndex: 1,
  },
  instructionText: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: spacing.xl,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  captureText: {
    fontSize: 16,
    color: colors.white,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default HandoverCamera; 