import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextStyle,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import AuthBackground from '../components/AuthBackground';
import { colors, spacing, typography, authStyles, shadows } from '../theme';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    setError(null);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'bagme://reset-password',
      });

      if (error) throw error;

      setEmailSent(true);
      Alert.alert(
        'Email Sent',
        'Check your email for the password reset link. You can close this screen.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      if (error.message.includes('rate limit')) {
        setError('Too many attempts. Please try again later.');
      } else if (error.message.includes('not found')) {
        setError('No account found with this email address.');
      } else {
        setError(error.message || 'Failed to send reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthBackground>
        <Animated.View 
          entering={FadeInDown.delay(200).springify()}
          style={styles.container}
        >
          <View style={styles.successContainer}>
            <Animated.View 
              style={[styles.successIconContainer, { backgroundColor: `${colors.auth.primary}20` }]}
              entering={FadeInDown.delay(400).springify()}
            >
              <Ionicons name="checkmark-circle" size={64} color={colors.auth.primary} />
            </Animated.View>
            <Animated.Text 
              entering={FadeInDown.delay(600).springify()}
              style={[authStyles.title, { color: colors.white }]}
            >
              Check Your Email
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(800).springify()}
              style={[authStyles.subtitle, { color: colors.auth.secondaryText }]}
            >
              We've sent a password reset link to {email}
            </Animated.Text>
            <Animated.View
              entering={FadeInDown.delay(1000).springify()}
              style={styles.buttonContainer}
            >
              <TouchableOpacity
                style={[styles.successButton, { backgroundColor: colors.auth.primary }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[authStyles.buttonText, { color: colors.white }]}>Back to Sign In</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <Animated.View 
          entering={FadeInDown.delay(200).springify()}
          style={styles.header}
        >
          <Text style={[authStyles.title, { color: colors.white }]}>Reset Password</Text>
          <Text style={[authStyles.subtitle, { color: colors.auth.secondaryText }]}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>
        </Animated.View>

        <Animated.View 
          entering={FadeInUp.delay(400).springify()}
          style={styles.form}
        >
          <View style={[
            styles.inputContainer,
            error && styles.inputError,
            isFocused && styles.inputFocused
          ]}>
            <Ionicons 
              name="mail-outline" 
              size={20} 
              color={isFocused ? colors.auth.primary : colors.text.secondary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: colors.text.primary }]}
              placeholder="Email"
              placeholderTextColor={colors.text.secondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          {error && (
            <Animated.View 
              entering={FadeInUp.springify()}
              style={styles.errorContainer}
            >
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          <TouchableOpacity
            style={[
              styles.resetButton,
              { backgroundColor: colors.auth.primary },
              loading && styles.disabledButton
            ]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[authStyles.buttonText, { color: colors.white }]}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={20} color={colors.white} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  header: {
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
  } as ViewStyle,
  form: {
    width: '100%',
    gap: spacing.md,
  } as ViewStyle,
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 56,
    ...shadows.small,
    borderWidth: 1,
    borderColor: 'transparent',
  } as ViewStyle,
  inputFocused: {
    borderColor: colors.auth.primary,
    borderWidth: 1,
  } as ViewStyle,
  inputError: {
    borderWidth: 1,
    borderColor: colors.error,
  } as ViewStyle,
  inputIcon: {
    marginRight: spacing.sm,
  } as ViewStyle,
  input: {
    flex: 1,
    height: '100%',
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  } as TextStyle,
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: `${colors.error}10`,
    padding: spacing.sm,
    borderRadius: 8,
  } as ViewStyle,
  errorText: {
    color: colors.error,
    fontSize: typography.sizes.sm,
    marginLeft: spacing.xs,
    flex: 1,
  } as TextStyle,
  resetButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    width: '100%',
    marginVertical: spacing.md,
    ...shadows.medium,
  } as ViewStyle,
  disabledButton: {
    opacity: 0.7,
  } as ViewStyle,
  backButton: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.lg,
    padding: spacing.sm,
  } as ViewStyle,
  backText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    marginLeft: spacing.xs,
    fontWeight: '500' as const,
  } as TextStyle,
  successContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  } as ViewStyle,
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
    ...shadows.medium,
  } as ViewStyle,
  buttonContainer: {
    width: '100%',
    marginTop: spacing.xl,
  } as ViewStyle,
  successButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    width: '100%',
    ...shadows.medium,
  } as ViewStyle,
}); 