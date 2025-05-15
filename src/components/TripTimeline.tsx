import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme';

type TripStatus = 'pending' | 'accepted' | 'in_transit' | 'delivered';

type TripTimelineProps = {
  status: TripStatus;
  pickupDate?: string;
  estimatedDeliveryDate?: string;
  deliveryDate?: string;
};

const TripTimeline = ({ 
  status, 
  pickupDate, 
  estimatedDeliveryDate, 
  deliveryDate 
}: TripTimelineProps) => {
  
  const isStepActive = (step: TripStatus): boolean => {
    const stages = ['pending', 'accepted', 'in_transit', 'delivered'];
    const currentIndex = stages.indexOf(status);
    const stepIndex = stages.indexOf(step);
    return stepIndex <= currentIndex;
  };
  
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not set';
    
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeline}>
        {/* Pending Stage */}
        <View style={styles.timelineStage}>
          <View style={[
            styles.timelineIcon, 
            isStepActive('pending') ? styles.activeIcon : styles.inactiveIcon
          ]}>
            <Ionicons 
              name="checkmark-circle"
              size={24} 
              color={isStepActive('pending') ? colors.white : colors.text.secondary} 
            />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[
              styles.timelineTitle,
              isStepActive('pending') ? styles.activeTitle : styles.inactiveTitle
            ]}>
              Trip Posted
            </Text>
            <Text style={styles.timelineDate}>
              {/* Use created_at for the trip posting date */}
              {formatDate(pickupDate)}
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.timelineConnector,
          isStepActive('accepted') ? styles.activeConnector : styles.inactiveConnector
        ]} />
        
        {/* Accepted Stage */}
        <View style={styles.timelineStage}>
          <View style={[
            styles.timelineIcon, 
            isStepActive('accepted') ? styles.activeIcon : styles.inactiveIcon
          ]}>
            <Ionicons 
              name="document-text"
              size={24} 
              color={isStepActive('accepted') ? colors.white : colors.text.secondary} 
            />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[
              styles.timelineTitle,
              isStepActive('accepted') ? styles.activeTitle : styles.inactiveTitle
            ]}>
              Item Accepted
            </Text>
            <Text style={styles.timelineDate}>
              {isStepActive('accepted') ? formatDate(pickupDate) : 'Waiting'}
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.timelineConnector,
          isStepActive('in_transit') ? styles.activeConnector : styles.inactiveConnector
        ]} />
        
        {/* In Transit Stage */}
        <View style={styles.timelineStage}>
          <View style={[
            styles.timelineIcon, 
            isStepActive('in_transit') ? styles.activeIcon : styles.inactiveIcon
          ]}>
            <Ionicons 
              name="airplane"
              size={24} 
              color={isStepActive('in_transit') ? colors.white : colors.text.secondary} 
            />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[
              styles.timelineTitle,
              isStepActive('in_transit') ? styles.activeTitle : styles.inactiveTitle
            ]}>
              In Transit
            </Text>
            <Text style={styles.timelineDate}>
              {isStepActive('in_transit') 
                ? `Est. delivery: ${formatDate(estimatedDeliveryDate)}` 
                : 'Waiting'
              }
            </Text>
          </View>
        </View>
        
        <View style={[
          styles.timelineConnector,
          isStepActive('delivered') ? styles.activeConnector : styles.inactiveConnector
        ]} />
        
        {/* Delivered Stage */}
        <View style={styles.timelineStage}>
          <View style={[
            styles.timelineIcon, 
            isStepActive('delivered') ? styles.activeIcon : styles.inactiveIcon
          ]}>
            <Ionicons 
              name="checkmark-done-circle"
              size={24} 
              color={isStepActive('delivered') ? colors.white : colors.text.secondary} 
            />
          </View>
          <View style={styles.timelineContent}>
            <Text style={[
              styles.timelineTitle,
              isStepActive('delivered') ? styles.activeTitle : styles.inactiveTitle
            ]}>
              Delivered
            </Text>
            <Text style={styles.timelineDate}>
              {isStepActive('delivered') ? formatDate(deliveryDate) : 'Waiting'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginVertical: spacing.md,
    ...shadows.small,
  },
  timeline: {
    paddingVertical: spacing.sm,
  },
  timelineStage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activeIcon: {
    backgroundColor: colors.primary,
  },
  inactiveIcon: {
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  timelineContent: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeTitle: {
    color: colors.text.primary,
  },
  inactiveTitle: {
    color: colors.text.secondary,
  },
  timelineDate: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  timelineConnector: {
    width: 2,
    height: 30,
    marginLeft: 23,
    marginVertical: 4,
  },
  activeConnector: {
    backgroundColor: colors.primary,
  },
  inactiveConnector: {
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
});

export default TripTimeline; 