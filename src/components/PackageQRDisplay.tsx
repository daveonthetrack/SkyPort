import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Dimensions,
    Modal,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, shadows, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PackageQRDisplayProps {
  visible: boolean;
  onClose: () => void;
  qrData: string;
  packageDetails: {
    title: string;
    destination: string;
    size: string;
    travelerName?: string;
  };
}

export const PackageQRDisplay: React.FC<PackageQRDisplayProps> = ({
  visible,
  onClose,
  qrData,
  packageDetails
}) => {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Package verification QR for "${packageDetails.title}" being delivered to ${packageDetails.destination}. Show this QR code to verify package authenticity upon delivery.`,
        title: 'Package Verification QR Code',
      });
    } catch (error) {
      console.error('Error sharing QR code:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="qr-code" size={24} color={colors.primary} />
              <Text style={styles.title}>Package Verification</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* QR Code Section */}
          <View style={styles.qrSection}>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={200}
                backgroundColor="white"
                color="black"
                logoBackgroundColor="transparent"
              />
            </View>
            
            <View style={styles.securityBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.white} />
              <Text style={styles.securityText}>Blockchain Verified</Text>
            </View>
          </View>

          {/* Package Information */}
          <View style={styles.packageInfo}>
            <Text style={styles.packageTitle}>📦 {packageDetails.title}</Text>
            <View style={styles.detailRow}>
              <Ionicons name="location" size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>To: {packageDetails.destination}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cube" size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>Size: {packageDetails.size}</Text>
            </View>
            {packageDetails.travelerName && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={16} color={colors.text.secondary} />
                <Text style={styles.detailText}>Traveler: {packageDetails.travelerName}</Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>1</Text>
              <Text style={styles.instructionText}>
                Show this QR code to the traveler upon delivery
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>2</Text>
              <Text style={styles.instructionText}>
                Traveler will scan the code to verify package authenticity
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionNumber}>3</Text>
              <Text style={styles.instructionText}>
                Delivery will be confirmed with blockchain verification
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share" size={20} color={colors.primary} />
              <Text style={styles.shareButtonText}>Share QR Code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  qrContainer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  securityText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  packageInfo: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  instructions: {
    marginBottom: spacing.lg,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  instructionNumber: {
    backgroundColor: colors.primary,
    color: colors.white,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
    fontWeight: '600',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
}); 