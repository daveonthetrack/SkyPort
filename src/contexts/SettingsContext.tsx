import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export type AppSettings = {
  // Notifications
  pushNotifications: boolean;
  emailNotifications: boolean;
  messageNotifications: boolean;
  deliveryNotifications: boolean;
  
  // Privacy & Security
  locationServices: boolean;
  shareLocation: boolean;
  profileVisibility: 'public' | 'private' | 'verified-only';
  
  // App Preferences
  darkMode: boolean;
  language: string;
  autoAcceptDeliveries: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
  
  // Traveler Specific
  autoAcceptRadius: number; // in kilometers
  maxItemWeight: number; // in kg
  preferredCategories: string[];
  
  // Sender Specific
  defaultTip: number; // percentage
  requireInsurance: boolean;
  maxDeliveryDistance: number; // in kilometers
};

type SettingsContextType = {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  resetSettings: () => Promise<void>;
  loading: boolean;
  onDarkModeChange?: (isDark: boolean) => void;
};

const defaultSettings: AppSettings = {
  // Notifications
  pushNotifications: true,
  emailNotifications: true,
  messageNotifications: true,
  deliveryNotifications: true,
  
  // Privacy & Security
  locationServices: true,
  shareLocation: true,
  profileVisibility: 'public',
  
  // App Preferences
  darkMode: false,
  language: 'en',
  autoAcceptDeliveries: false,
  soundEnabled: true,
  hapticFeedback: true,
  
  // Traveler Specific
  autoAcceptRadius: 10,
  maxItemWeight: 20,
  preferredCategories: [],
  
  // Sender Specific
  defaultTip: 10,
  requireInsurance: false,
  maxDeliveryDistance: 50,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = '@app_settings';

export const SettingsProvider: React.FC<{ 
  children: React.ReactNode;
  onDarkModeChange?: (isDark: boolean) => void;
}> = ({ children, onDarkModeChange }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Load settings from storage on app start
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        // Merge with default settings to ensure all keys exist
        const mergedSettings = { ...defaultSettings, ...parsedSettings };
        setSettings(mergedSettings);
        
        // Apply dark mode setting
        if (onDarkModeChange) {
          onDarkModeChange(mergedSettings.darkMode);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings. Using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings.');
      throw error;
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await saveSettings(newSettings);
      
      // Handle special cases
      if (key === 'pushNotifications' && !value) {
        // If disabling push notifications, also disable specific notification types
        const updatedSettings = {
          ...newSettings,
          messageNotifications: false,
          deliveryNotifications: false,
        };
        setSettings(updatedSettings);
        await saveSettings(updatedSettings);
      }
      
      if (key === 'locationServices' && !value) {
        // If disabling location services, also disable location sharing
        const updatedSettings = {
          ...newSettings,
          shareLocation: false,
        };
        setSettings(updatedSettings);
        await saveSettings(updatedSettings);
      }
      
      // Handle dark mode changes
      if (key === 'darkMode' && onDarkModeChange) {
        onDarkModeChange(value as boolean);
      }
      
    } catch (error) {
      console.error('Error updating setting:', error);
      // Revert the change if saving failed
      setSettings(settings);
      throw error;
    }
  };

  const resetSettings = async () => {
    try {
      setSettings(defaultSettings);
      await saveSettings(defaultSettings);
      
      // Reset dark mode
      if (onDarkModeChange) {
        onDarkModeChange(defaultSettings.darkMode);
      }
      
      Alert.alert('Success', 'Settings have been reset to defaults.');
    } catch (error) {
      console.error('Error resetting settings:', error);
      Alert.alert('Error', 'Failed to reset settings.');
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        loading,
        onDarkModeChange,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 