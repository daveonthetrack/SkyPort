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
    Vibration,
    View,
} from 'react-native';
import { colors, shadows, spacing } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface QRScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onCancel,
  title = "Scan Package QR",
  subtitle = "Position the QR code within the frame"
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const scanAnim = useRef(new Animated.Value(0)).current;
  
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission === null) {
      requestPermission();
    } else {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  useEffect(() => {
    // Animated scanning line
    const animate = () => {
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };
    
    animate();
  }, []);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100); // Haptic feedback
    
    // Validate QR code format
    try {
      const qrData = JSON.parse(data);
      if (qrData.packageId && qrData.senderDID) {
        onScan(data);
      } else {
        Alert.alert(
          'Invalid QR Code',
          'This is not a valid package verification QR code.',
          [
            {
              text: 'Try Again',
              onPress: () => setScanned(false)
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Invalid QR Code',
        'Unable to read QR code. Please ensure it\'s a valid package verification code.',
        [
          {
            text: 'Try Again',
            onPress: () => setScanned(false)
          }
        ]
      );
    }
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
          Please grant camera permissions to scan QR codes
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => requestPermission()}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
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
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </LinearGradient>

        {/* Scanning Frame */}
        <View style={styles.scanFrame}>
          <View style={styles.frameContainer}>
            {/* Corner indicators */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* Animated scanning line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{
                    translateY: scanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 200],
                    }),
                  }],
                },
              ]}
            />
          </View>
        </View>

        {/* Instructions */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.instructions}
        >
          <View style={styles.instructionContent}>
            <Ionicons name="qr-code" size={48} color={colors.white} />
            <Text style={styles.instructionTitle}>
              {scanned ? 'Processing...' : 'Scan Package QR Code'}
            </Text>
            <Text style={styles.instructionText}>
              {scanned 
                ? 'Verifying package authenticity...'
                : 'Position the sender\'s QR code within the frame above'
              }
            </Text>
            
            {scanned && (
              <ActivityIndicator size="small" color={colors.white} style={styles.loader} />
            )}
          </View>
        </LinearGradient>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.sm,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameContainer: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  instructions: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  instructionContent: {
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  loader: {
    marginTop: spacing.md,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  permissionText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    ...shadows.medium,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
}); 