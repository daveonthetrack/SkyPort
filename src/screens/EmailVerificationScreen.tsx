import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { borderRadius, colors, shadows, spacing } from '../theme';

export default function EmailVerificationScreen() {
  const navigation = useNavigation();
  const { session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  useEffect(() => {
    // Listen for auth state changes to detect email verification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (session?.user?.email_confirmed_at) {
          console.log('Email verification detected in EmailVerificationScreen');
          
          try {
            // Update the profile to mark email as verified
            const { error } = await supabase
              .from('profiles')
              .update({ 
                is_email_verified: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', session.user.id);
              
            if (error) {
              console.error('Error updating email verification status:', error);
            } else {
              await refreshProfile();
              
              Alert.alert(
                'Email Verified!',
                'Your email address has been successfully verified. Your trust score has been updated.',
                [{ 
                  text: 'Great!', 
                  onPress: () => navigation.goBack()
                }]
              );
            }
          } catch (error) {
            console.error('Error handling email verification:', error);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendVerificationEmail = async () => {
    if (!session?.user?.email) {
      Alert.alert('Error', 'No email address found in your account');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: session.user.email,
        options: {
          emailRedirectTo: 'skyport://verify-email'
        }
      });

      if (error) throw error;

      setEmailSent(true);
      setResendTimer(60);
      
      Alert.alert(
        'Verification Email Sent',
        'Please check your email and click the verification link. You may need to check your spam folder.'
      );
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate_limit') || error.message?.includes('too_many_requests')) {
        Alert.alert(
          'Rate Limit Exceeded', 
          'Too many email requests. Please wait a few minutes before trying again.',
          [{ text: 'OK' }]
        );
        setResendTimer(300); // 5 minutes
      } else if (error.message?.includes('invalid_email')) {
        Alert.alert('Invalid Email', 'Please check your email address and try again.');
      } else {
        Alert.alert('Error', error.message || 'Failed to send verification email');
      }
    } finally {
      setLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      // Refresh the session to get latest user data
      const { data: { session: refreshedSession }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (refreshedSession?.user?.email_confirmed_at) {
        // Update profile verification status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_email_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', refreshedSession.user.id);
          
        if (updateError) throw updateError;
        
        await refreshProfile();
        
        Alert.alert(
          'Email Verified!',
          'Your email address has been successfully verified.',
          [{ 
            text: 'Great!', 
            onPress: () => navigation.goBack()
          }]
        );
      } else {
        Alert.alert(
          'Not Verified Yet',
          'Your email is not verified yet. Please check your email and click the verification link.'
        );
      }
    } catch (error: any) {
      console.error('Error checking verification status:', error);
      Alert.alert('Error', error.message || 'Failed to check verification status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, '#4A90E2']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Verification</Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Email Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail" size={80} color={colors.primary} />
        </View>

        {/* Title and Description */}
        <Text style={styles.title}>Verify Your Email Address</Text>
        <Text style={styles.description}>
          We need to verify your email address to secure your account and build trust with other users.
        </Text>

        {/* Email Display */}
        <View style={styles.emailContainer}>
          <Ionicons name="mail-outline" size={20} color={colors.text.secondary} />
          <Text style={styles.emailText}>{session?.user?.email}</Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Benefits of Email Verification:</Text>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.benefitText}>Increase your trust score by 25%</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.benefitText}>Secure account recovery</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
            <Text style={styles.benefitText}>Important notifications</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={sendVerificationEmail}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={colors.white} />
              <Text style={styles.sendButtonText}>
                {emailSent ? 'Resend Verification Email' : 'Send Verification Email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {resendTimer > 0 && (
          <Text style={styles.timerText}>
            You can resend the email in {resendTimer} seconds
          </Text>
        )}

        <TouchableOpacity
          style={styles.checkButton}
          onPress={checkVerificationStatus}
          disabled={loading}
        >
          <Ionicons name="refresh" size={20} color={colors.primary} />
          <Text style={styles.checkButtonText}>Check Verification Status</Text>
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>Didn't receive the email?</Text>
          <Text style={styles.helpText}>
            • Check your spam/junk folder{'\n'}
            • Make sure the email address is correct{'\n'}
            • Try resending the verification email{'\n'}
            • Contact support if you continue having issues
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  emailText: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    ...shadows.small,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  benefitText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    width: '100%',
    ...shadows.small,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  timerText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.xl,
  },
  checkButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  helpContainer: {
    width: '100%',
    backgroundColor: '#FFF9E6',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
}); 