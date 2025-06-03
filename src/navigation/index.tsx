import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import PhoneVerificationScreen from '../screens/PhoneVerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import { TabNavigator } from './TabNavigator';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const Navigation = () => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      ) : !profile ? (
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <Stack.Screen name="MainApp" component={TabNavigator} />
      )}
      <Stack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
    </Stack.Navigator>
  );
}; 