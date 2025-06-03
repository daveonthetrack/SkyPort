import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { notificationService } from '../services/NotificationService';
import { borderRadius, getShadows, spacing, typography } from '../theme';

type SettingItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  type: 'toggle' | 'navigation' | 'action' | 'picker';
  value?: boolean | string | number;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  disabled?: boolean;
  options?: { label: string; value: string }[];
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { signOut, profile } = useAuth();
  const { settings, updateSetting, resetSettings, loading } = useSettings();
  const { theme } = useTheme();
  const [updating, setUpdating] = useState<string | null>(null);

  const isTraveler = profile?.role === 'traveler';
  const themeColors = theme.colors;
  const shadows = getShadows(theme);

  const handleToggle = async (key: keyof typeof settings, value: boolean) => {
    try {
      setUpdating(key);
      
      // Provide haptic feedback if enabled
      if (settings.hapticFeedback && key !== 'hapticFeedback') {
        Vibration.vibrate(50); // Short vibration for feedback
      }
      
      await updateSetting(key, value);
      
      // Handle special cases for notification settings
      if (key === 'pushNotifications' && value) {
        const hasPermission = await notificationService.requestPermissions();
        if (!hasPermission) {
          // Revert the setting if permission was denied
          await updateSetting(key, false);
          Alert.alert(
            'Permission Required',
            'Push notifications require permission. Please enable notifications in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      }
      
      // Handle location services
      if (key === 'locationServices' && value) {
        Alert.alert(
          'Location Services',
          'Location services help us provide better matching between senders and travelers. This feature will be fully implemented in the next update.',
          [{ text: 'OK' }]
        );
      }
      
      // Handle haptic feedback toggle
      if (key === 'hapticFeedback' && value) {
        Vibration.vibrate(100); // Longer vibration to demonstrate
        Alert.alert(
          'Haptic Feedback Enabled',
          'You should feel a vibration when interacting with the app.',
          [{ text: 'OK' }]
        );
      }
      
      // Handle sound effects toggle
      if (key === 'soundEnabled') {
        Alert.alert(
          'Sound Effects',
          value ? 'Sound effects are now enabled.' : 'Sound effects are now disabled.',
          [{ text: 'OK' }]
        );
      }
      
      // Handle auto-accept deliveries
      if (key === 'autoAcceptDeliveries' && value) {
        Alert.alert(
          'Auto-Accept Enabled',
          'The app will now automatically accept delivery requests that match your criteria. You can adjust your criteria in the settings below.',
          [{ text: 'OK' }]
        );
      }
      
      // Handle dark mode changes
      if (key === 'darkMode') {
        Alert.alert(
          'Theme Changed',
          value ? 'Dark mode has been enabled!' : 'Light mode has been enabled!',
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('Error updating setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const handlePrivacyPicker = () => {
    const options = [
      { label: 'Public', value: 'public' },
      { label: 'Verified Users Only', value: 'verified-only' },
      { label: 'Private', value: 'private' },
    ];

    Alert.alert(
      'Profile Visibility',
      'Choose who can see your profile',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: async () => {
            try {
              setUpdating('profileVisibility');
              await updateSetting('profileVisibility', option.value as any);
            } catch (error) {
              console.error('Error updating privacy setting:', error);
            } finally {
              setUpdating(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleLanguagePicker = () => {
    const languages = [
      { label: 'English', value: 'en' },
      { label: 'Spanish', value: 'es' },
      { label: 'French', value: 'fr' },
      { label: 'German', value: 'de' },
      { label: 'Italian', value: 'it' },
    ];

    Alert.alert(
      'Language',
      'Choose your preferred language',
      [
        ...languages.map(lang => ({
          text: lang.label,
          onPress: async () => {
            try {
              setUpdating('language');
              await updateSetting('language', lang.value);
              Alert.alert('Language Updated', 'Language will be applied on next app restart.');
            } catch (error) {
              console.error('Error updating language:', error);
            } finally {
              setUpdating(null);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const settingSections = [
    {
      title: 'Notifications',
      items: [
        {
          id: 'pushNotifications',
          title: 'Push Notifications',
          subtitle: 'Receive push notifications on your device',
          icon: 'notifications-outline' as const,
          type: 'toggle' as const,
          value: settings.pushNotifications,
          onToggle: (value: boolean) => handleToggle('pushNotifications', value),
        },
        {
          id: 'messageNotifications',
          title: 'Message Notifications',
          subtitle: 'Get notified when you receive new messages',
          icon: 'chatbubble-outline' as const,
          type: 'toggle' as const,
          value: settings.messageNotifications,
          onToggle: (value: boolean) => handleToggle('messageNotifications', value),
          disabled: !settings.pushNotifications,
        },
        {
          id: 'deliveryNotifications',
          title: 'Delivery Notifications',
          subtitle: 'Get notified about delivery status updates',
          icon: 'cube-outline' as const,
          type: 'toggle' as const,
          value: settings.deliveryNotifications,
          onToggle: (value: boolean) => handleToggle('deliveryNotifications', value),
          disabled: !settings.pushNotifications,
        },
        {
          id: 'emailNotifications',
          title: 'Email Notifications',
          subtitle: 'Receive important updates via email',
          icon: 'mail-outline' as const,
          type: 'toggle' as const,
          value: settings.emailNotifications,
          onToggle: (value: boolean) => handleToggle('emailNotifications', value),
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          id: 'locationServices',
          title: 'Location Services',
          subtitle: 'Allow app to access your location for better matching',
          icon: 'location-outline' as const,
          type: 'toggle' as const,
          value: settings.locationServices,
          onToggle: (value: boolean) => handleToggle('locationServices', value),
        },
        {
          id: 'shareLocation',
          title: 'Share Location',
          subtitle: 'Share your location with other users',
          icon: 'navigate-outline' as const,
          type: 'toggle' as const,
          value: settings.shareLocation,
          onToggle: (value: boolean) => handleToggle('shareLocation', value),
          disabled: !settings.locationServices,
        },
        {
          id: 'profileVisibility',
          title: 'Profile Visibility',
          subtitle: `Currently: ${settings.profileVisibility.charAt(0).toUpperCase() + settings.profileVisibility.slice(1)}`,
          icon: 'eye-outline' as const,
          type: 'picker' as const,
          onPress: handlePrivacyPicker,
        },
        {
          id: 'privacy',
          title: 'Privacy Policy',
          subtitle: 'View our privacy policy',
          icon: 'shield-outline' as const,
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert(
              'Privacy Policy',
              'Our privacy policy ensures your data is protected and used responsibly. We never share your personal information without consent.\n\nKey points:\n• Your data is encrypted\n• We don\'t sell your information\n• You control your privacy settings\n• You can delete your account anytime',
              [
                { text: 'Read Full Policy', onPress: () => {
                  const privacyUrl = 'https://bagme.app/privacy'; // Replace with actual URL
                  Linking.openURL(privacyUrl).catch(() => {
                    Alert.alert('Error', 'Could not open privacy policy. Please visit bagme.app/privacy');
                  });
                }},
                { text: 'Close', style: 'cancel' },
              ]
            );
          },
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          subtitle: 'View terms and conditions',
          icon: 'document-text-outline' as const,
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert(
              'Terms of Service',
              'By using BagMe, you agree to our terms of service. Please use the platform responsibly and respect other users.\n\nKey terms:\n• Be respectful to other users\n• No prohibited items\n• Accurate information required\n• Follow local laws',
              [
                { text: 'Read Full Terms', onPress: () => {
                  const termsUrl = 'https://bagme.app/terms'; // Replace with actual URL
                  Linking.openURL(termsUrl).catch(() => {
                    Alert.alert('Error', 'Could not open terms of service. Please visit bagme.app/terms');
                  });
                }},
                { text: 'Close', style: 'cancel' },
              ]
            );
          },
        },
      ],
    },
    {
      title: 'App Preferences',
      items: [
        {
          id: 'language',
          title: 'Language',
          subtitle: `Currently: ${settings.language.toUpperCase()}`,
          icon: 'language-outline' as const,
          type: 'picker' as const,
          onPress: handleLanguagePicker,
        },
        {
          id: 'soundEnabled',
          title: 'Sound Effects',
          subtitle: 'Play sounds for app interactions',
          icon: 'volume-high-outline' as const,
          type: 'toggle' as const,
          value: settings.soundEnabled,
          onToggle: (value: boolean) => handleToggle('soundEnabled', value),
        },
        {
          id: 'hapticFeedback',
          title: 'Haptic Feedback',
          subtitle: 'Feel vibrations for app interactions',
          icon: 'phone-portrait-outline' as const,
          type: 'toggle' as const,
          value: settings.hapticFeedback,
          onToggle: (value: boolean) => handleToggle('hapticFeedback', value),
        },
        {
          id: 'darkMode',
          title: 'Dark Mode',
          subtitle: 'Use dark theme',
          icon: 'moon-outline' as const,
          type: 'toggle' as const,
          value: settings.darkMode,
          onToggle: (value: boolean) => {
            handleToggle('darkMode', value);
          },
        },
      ],
    },
    ...(isTraveler ? [{
      title: 'Traveler Settings',
      items: [
        {
          id: 'autoAcceptDeliveries',
          title: 'Auto-Accept Deliveries',
          subtitle: 'Automatically accept delivery requests that match your criteria',
          icon: 'checkmark-circle-outline' as const,
          type: 'toggle' as const,
          value: settings.autoAcceptDeliveries,
          onToggle: (value: boolean) => handleToggle('autoAcceptDeliveries', value),
        },
        {
          id: 'autoAcceptRadius',
          title: 'Auto-Accept Radius',
          subtitle: `Currently: ${settings.autoAcceptRadius}km from your route`,
          icon: 'radio-outline' as const,
          type: 'picker' as const,
          onPress: () => {
            const radiusOptions = [5, 10, 15, 20, 25, 30];
            Alert.alert(
              'Auto-Accept Radius',
              'Choose the maximum distance from your route to auto-accept deliveries',
              [
                ...radiusOptions.map(radius => ({
                  text: `${radius}km`,
                  onPress: async () => {
                    try {
                      setUpdating('autoAcceptRadius');
                      await updateSetting('autoAcceptRadius', radius);
                    } catch (error) {
                      console.error('Error updating radius:', error);
                    } finally {
                      setUpdating(null);
                    }
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
        {
          id: 'maxItemWeight',
          title: 'Maximum Item Weight',
          subtitle: `Currently: ${settings.maxItemWeight}kg`,
          icon: 'barbell-outline' as const,
          type: 'picker' as const,
          onPress: () => {
            const weightOptions = [5, 10, 15, 20, 25, 30, 40, 50];
            Alert.alert(
              'Maximum Item Weight',
              'Choose the maximum weight of items you\'re willing to carry',
              [
                ...weightOptions.map(weight => ({
                  text: `${weight}kg`,
                  onPress: async () => {
                    try {
                      setUpdating('maxItemWeight');
                      await updateSetting('maxItemWeight', weight);
                    } catch (error) {
                      console.error('Error updating weight:', error);
                    } finally {
                      setUpdating(null);
                    }
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
      ],
    }] : [{
      title: 'Sender Settings',
      items: [
        {
          id: 'defaultTip',
          title: 'Default Tip',
          subtitle: `Currently: ${settings.defaultTip}%`,
          icon: 'card-outline' as const,
          type: 'picker' as const,
          onPress: () => {
            const tipOptions = [0, 5, 10, 15, 20, 25];
            Alert.alert(
              'Default Tip Percentage',
              'Choose your default tip percentage for deliveries',
              [
                ...tipOptions.map(tip => ({
                  text: `${tip}%`,
                  onPress: async () => {
                    try {
                      setUpdating('defaultTip');
                      await updateSetting('defaultTip', tip);
                    } catch (error) {
                      console.error('Error updating tip:', error);
                    } finally {
                      setUpdating(null);
                    }
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
        {
          id: 'requireInsurance',
          title: 'Require Insurance',
          subtitle: 'Only accept deliveries from insured travelers',
          icon: 'shield-checkmark-outline' as const,
          type: 'toggle' as const,
          value: settings.requireInsurance,
          onToggle: (value: boolean) => handleToggle('requireInsurance', value),
        },
        {
          id: 'maxDeliveryDistance',
          title: 'Maximum Delivery Distance',
          subtitle: `Currently: ${settings.maxDeliveryDistance}km`,
          icon: 'map-outline' as const,
          type: 'picker' as const,
          onPress: () => {
            const distanceOptions = [10, 25, 50, 100, 200, 500];
            Alert.alert(
              'Maximum Delivery Distance',
              'Choose the maximum distance for your deliveries',
              [
                ...distanceOptions.map(distance => ({
                  text: `${distance}km`,
                  onPress: async () => {
                    try {
                      setUpdating('maxDeliveryDistance');
                      await updateSetting('maxDeliveryDistance', distance);
                    } catch (error) {
                      console.error('Error updating distance:', error);
                    } finally {
                      setUpdating(null);
                    }
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          },
        },
      ],
    }]),
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Edit Profile',
          subtitle: 'Update your personal information',
          icon: 'person-outline' as const,
          type: 'navigation' as const,
          onPress: () => navigation.navigate('Profile' as never),
        },
        {
          id: 'verification',
          title: 'Account Verification',
          subtitle: 'Verify your identity to build trust',
          icon: 'shield-checkmark-outline' as const,
          type: 'navigation' as const,
          onPress: () => navigation.navigate('Profile' as never),
        },
        {
          id: 'resetSettings',
          title: 'Reset Settings',
          subtitle: 'Reset all settings to default values',
          icon: 'refresh-outline' as const,
          type: 'action' as const,
          onPress: () => {
            Alert.alert(
              'Reset Settings',
              'Are you sure you want to reset all settings to their default values?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: resetSettings,
                },
              ]
            );
          },
        },
        {
          id: 'delete',
          title: 'Delete Account',
          subtitle: 'Permanently delete your account',
          icon: 'trash-outline' as const,
          type: 'action' as const,
          onPress: () => {
            Alert.alert(
              'Delete Account',
              'Are you sure you want to delete your account? This action cannot be undone.\n\nAll your data including:\n• Profile information\n• Message history\n• Delivery history\n• Settings\n\nWill be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Account Deletion',
                      'Account deletion feature will be available soon. Please contact support at support@bagme.app for assistance.'
                    );
                  },
                },
              ]
            );
          },
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Get help with using the app',
          icon: 'help-circle-outline' as const,
          type: 'navigation' as const,
          onPress: () => navigation.navigate('HelpSupport' as never),
        },
        {
          id: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Help us improve the app',
          icon: 'chatbubble-outline' as const,
          type: 'action' as const,
          onPress: () => {
            const subject = 'BagMe App Feedback';
            const body = `Hi BagMe Team,

I would like to provide feedback about the app:

App Version: 1.0.0
Device: ${Platform.OS}
User Role: ${isTraveler ? 'Traveler' : 'Sender'}

Feedback:
[Please write your feedback here]

Thank you!`;
            
            const emailUrl = `mailto:support@bagme.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            Linking.openURL(emailUrl).catch(() => {
              Alert.alert(
                'Email Not Available',
                'Please send your feedback to support@bagme.app manually.',
                [{ text: 'OK' }]
              );
            });
          },
        },
        {
          id: 'rate',
          title: 'Rate the App',
          subtitle: 'Rate us on the App Store',
          icon: 'star-outline' as const,
          type: 'action' as const,
          onPress: () => {
            const appStoreUrl = Platform.select({
              ios: 'https://apps.apple.com/app/bagme/id123456789', // Replace with actual App Store ID
              android: 'https://play.google.com/store/apps/details?id=com.bagme.app', // Replace with actual package name
            });
            
            if (appStoreUrl) {
              Linking.openURL(appStoreUrl).catch(() => {
                Alert.alert(
                  'Store Not Available',
                  'Please search for "BagMe" in your device\'s app store to rate us.',
                  [{ text: 'OK' }]
                );
              });
            } else {
              Alert.alert(
                'Rate BagMe',
                'Thank you for using BagMe! Please search for "BagMe" in your device\'s app store to rate us.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ],
    },
  ];

  const renderSettingItem = (item: SettingItem) => {
    const isUpdating = updating === item.id;
    const isDisabled = item.disabled || isUpdating;

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.settingItem, 
          { borderBottomColor: themeColors.border },
          isDisabled && styles.settingItemDisabled
        ]}
        onPress={item.onPress}
        disabled={item.type === 'toggle' || isDisabled}
        activeOpacity={0.7}
      >
        <View style={[
          styles.settingIcon, 
          { backgroundColor: themeColors.primary + '10' }
        ]}>
          <Ionicons 
            name={item.icon} 
            size={24} 
            color={isDisabled ? themeColors.text.secondary : themeColors.primary} 
          />
        </View>
        <View style={styles.settingContent}>
          <Text style={[
            styles.settingTitle, 
            { color: isDisabled ? themeColors.text.secondary : themeColors.text.primary }
          ]}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={[
              styles.settingSubtitle, 
              { color: isDisabled ? themeColors.text.light : themeColors.text.secondary }
            ]}>
              {item.subtitle}
            </Text>
          )}
        </View>
        <View style={styles.settingAction}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={themeColors.primary} />
          ) : item.type === 'toggle' ? (
            <Switch
              value={item.value as boolean}
              onValueChange={item.onToggle}
              trackColor={{ false: themeColors.border, true: themeColors.primary + '40' }}
              thumbColor={(item.value as boolean) ? themeColors.primary : themeColors.text.secondary}
              disabled={isDisabled}
            />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={themeColors.text.secondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: themeColors.background }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {settingSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text.primary }]}>{section.title}</Text>
          <View style={[styles.sectionContent, { backgroundColor: themeColors.surface }, shadows.small]}>
            {section.items.map(renderSettingItem)}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <View style={[styles.sectionContent, { backgroundColor: themeColors.surface }, shadows.small]}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.versionText, { color: themeColors.text.secondary }]}>BagMe v1.0.0</Text>
        <Text style={[styles.copyrightText, { color: themeColors.text.secondary }]}>© 2024 BagMe. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
  sectionContent: {
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  settingTitleDisabled: {},
  settingSubtitle: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
  },
  settingSubtitleDisabled: {},
  settingAction: {
    marginLeft: spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  signOutText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  versionText: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  copyrightText: {
    fontSize: typography.sizes.xs,
  },
}); 