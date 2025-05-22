import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import { TabNavigator } from './src/navigation/TabNavigator';
import { RootStackParamList } from './src/navigation/types';
import { registerRootComponent } from 'expo';
import * as ExpoAsset from 'expo-asset';
import { View, Text } from 'react-native';
import { testSupabaseConnection } from './src/lib/supabase';

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

function App() {
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading app: {error.message}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <Navigation />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Register the app component
registerRootComponent(App);

export default App; 