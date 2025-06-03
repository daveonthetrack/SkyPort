// Polyfills must be imported first
import 'react-native-get-random-values';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { registerRootComponent } from 'expo';
import * as ExpoAsset from 'expo-asset';
import React, { useEffect } from 'react';
import { StatusBar, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { DIDProvider } from './src/contexts/DIDContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { testSupabaseConnection } from './src/lib/supabase';
import { TabNavigator } from './src/navigation/TabNavigator';
import { RootStackParamList } from './src/navigation/types';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navigation() {
  const { session, profile } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : !profile ? (
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <Stack.Screen name="MainApp" component={TabNavigator} />
      )}
    </Stack.Navigator>
  );
}

function ThemeSync() {
  const { settings, loading } = useSettings();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!loading) {
      setTheme(settings.darkMode);
    }
  }, [settings.darkMode, loading, setTheme]);

  return null;
}

function AppContent() {
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    async function prepare() {
      try {
        // Test Supabase connection
        const isConnected = await testSupabaseConnection();
        if (!isConnected) {
          throw new Error('Failed to connect to Supabase. Please check your internet connection and try again.');
        }

        // Initialize assets
        await ExpoAsset.Asset.loadAsync([]);
        setIsReady(true);
      } catch (e) {
        console.error('Error preparing app:', e);
        setError(e as Error);
      }
    }

    prepare();
  }, []);

  if (error) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background 
      }}>
        <StatusBar 
          barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background}
        />
        <Text style={{ color: theme.colors.text.primary }}>
          Error loading app: {error.message}
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.colors.background 
      }}>
        <StatusBar 
          barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background}
        />
        <Text style={{ color: theme.colors.text.primary }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={theme.isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background}
      />
      <ThemeSync />
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DIDProvider>
          <SettingsProvider>
            <AppContent />
          </SettingsProvider>
        </DIDProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Register the app component
registerRootComponent(App);

export default App; 