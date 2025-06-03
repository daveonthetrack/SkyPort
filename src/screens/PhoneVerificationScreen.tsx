import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sendPhoneVerificationCode, verifyPhoneCode } from '../lib/verification';

// Flexible type for phone verification that works in both contexts
type PhoneVerificationParams = {
  phoneNumber: string;
};

export default function PhoneVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Get phone number from route params with type safety
  const { phoneNumber } = (route.params as PhoneVerificationParams) || { phoneNumber: '' };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the complete verification code');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPhoneCode(phoneNumber, verificationCode);
      
      if (result.success) {
        await refreshProfile();
        Alert.alert(
          'Success',
          'Phone number verified successfully!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error(result.error || 'Verification failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    try {
      setLoading(true);
      const result = await sendPhoneVerificationCode(phoneNumber);
      
      if (result.success) {
        setResendTimer(60);
        setCanResend(false);
        
        // Show different message for development vs production
        const message = result.message || 'Verification code resent successfully';
        Alert.alert('Success', message);
      } else {
        throw new Error(result.error || 'Failed to resend code');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend verification code');
    } finally {
      setLoading(false);
    }
  };

  // Send initial code when component mounts
  useEffect(() => {
    const sendInitialCode = async () => {
      try {
        const result = await sendPhoneVerificationCode(phoneNumber);
        if (result.success && result.message) {
          // Show development mode message
          Alert.alert('Development Mode', result.message);
        }
      } catch (error) {
        console.error('Error sending initial code:', error);
      }
    };
    
    sendInitialCode();
  }, [phoneNumber]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Verify Phone Number</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to {phoneNumber}
        </Text>

        {/* Development Mode Indicator */}
        {__DEV__ && (
          <View style={styles.devModeContainer}>
            <Text style={styles.devModeTitle}>🔧 Development Mode</Text>
            <Text style={styles.devModeText}>Use code: 123456</Text>
          </View>
        )}

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.codeInput}
              value={digit}
              onChangeText={text => handleCodeChange(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, !canResend && styles.resendButtonDisabled]}
          onPress={handleResendCode}
          disabled={!canResend || loading}
        >
          <Text style={[styles.resendButtonText, !canResend && styles.resendButtonTextDisabled]}>
            {canResend ? 'Resend Code' : `Resend in ${resendTimer}s`}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  codeInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    padding: 8,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  resendButtonTextDisabled: {
    color: '#999',
  },
  devModeContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  devModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  devModeText: {
    fontSize: 14,
    color: '#666',
  },
}); 