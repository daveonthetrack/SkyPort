import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export type VerificationType = 'email' | 'phone' | 'id' | 'social';

export interface VerificationStatus {
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isIdVerified: boolean;
  isSocialConnected: boolean;
  trustLevel: number;
}

export const sendVerificationEmail = async (email: string) => {
  try {
    // Validate email format before making API call
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: Linking.createURL('/verify-email'),
      },
    });
    
    if (error) {
      // Handle specific Supabase errors
      if (error.message.includes('rate_limit') || error.message.includes('too_many_requests')) {
        throw new Error('Too many email requests. Please wait a few minutes before trying again.');
      }
      throw error;
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

export const sendPhoneVerificationCode = async (phoneNumber: string) => {
  try {
    // Format phone number to E.164 format if not already
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    // Development mode - for testing without actual SMS
    const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, we'll simulate sending a code
      // Store a test code in AsyncStorage or just use a fixed code
      console.log('🔐 Development Mode: Phone verification code is 123456');
      
      // You could also store this in AsyncStorage for persistence
      // await AsyncStorage.setItem(`phone_code_${formattedPhone}`, '123456');
      
      return { success: true, message: 'Development mode: Use code 123456' };
    }
    
    // Production mode - use Supabase OTP
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        channel: 'sms'
      }
    });
    
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error sending phone verification code:', error);
    return { success: false, error: error.message };
  }
};

export const verifyPhoneCode = async (phoneNumber: string, code: string) => {
  try {
    // Format phone number to E.164 format if not already
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    // Development mode - accept test code
    const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, accept the test code 123456
      if (code === '123456') {
        // Get the current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          throw new Error('No user session found');
        }
        
        // Update profile verification status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_phone_verified: true,
            phone_number: formattedPhone,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id);
          
        if (updateError) throw updateError;
        
        return { success: true, message: 'Phone verified in development mode' };
      } else {
        throw new Error('Invalid code. Use 123456 for development testing.');
      }
    }
    
    // Production mode - use Supabase OTP verification
    const { error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: code,
      type: 'sms'
    });
    
    if (error) throw error;
    
    // Get the user ID from the session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      throw new Error('No user session found');
    }
    
    // Update profile verification status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_phone_verified: true,
        phone_number: formattedPhone,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id);
      
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error verifying phone code:', error);
    return { success: false, error: error.message };
  }
};

export const uploadIdVerification = async (userId: string, imageUri: string) => {
  try {
    // Development mode - simulate ID verification
    const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('🆔 Development Mode: Simulating ID verification upload');
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a mock verification request
      const { error: requestError } = await supabase
        .from('verification_requests')
        .insert({
          user_id: userId,
          type: 'id',
          document_url: 'mock://development-id-image.jpg',
          status: 'approved', // Auto-approve in development
          created_at: new Date().toISOString(),
        });
        
      if (requestError) throw requestError;
      
      // Update profile to mark ID as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_id_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      
      return { success: true, message: 'ID verified in development mode' };
    }
    
    // Production mode - actual file upload
    // Generate unique filename
    const fileName = `id_verification_${userId}_${Date.now()}.jpg`;
    
    // Convert image to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('verifications')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
      
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('verifications')
      .getPublicUrl(fileName);
      
    // Create verification request
    const { error: requestError } = await supabase
      .from('verification_requests')
      .insert({
        user_id: userId,
        type: 'id',
        document_url: publicUrl,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      
    if (requestError) throw requestError;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error uploading ID verification:', error);
    return { success: false, error: error.message };
  }
};

export const getVerificationStatus = async (userId: string): Promise<VerificationStatus> => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_email_verified, is_phone_verified, is_id_verified, is_social_connected, trust_level')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    return {
      isEmailVerified: profile.is_email_verified || false,
      isPhoneVerified: profile.is_phone_verified || false,
      isIdVerified: profile.is_id_verified || false,
      isSocialConnected: profile.is_social_connected || false,
      trustLevel: profile.trust_level || 0,
    };
  } catch (error: any) {
    console.error('Error getting verification status:', error);
    return {
      isEmailVerified: false,
      isPhoneVerified: false,
      isIdVerified: false,
      isSocialConnected: false,
      trustLevel: 0,
    };
  }
};

export const calculateTrustLevel = (verificationStatus: VerificationStatus): number => {
  let trustScore = 0;
  
  if (verificationStatus.isEmailVerified) trustScore += 25;
  if (verificationStatus.isPhoneVerified) trustScore += 25;
  if (verificationStatus.isIdVerified) trustScore += 30;
  if (verificationStatus.isSocialConnected) trustScore += 20;
  
  return Math.min(trustScore, 100);
};

export const connectSocialAccount = async (userId: string, provider: string) => {
  try {
    // In a real app, you would integrate with OAuth
    // For now, we'll simulate the connection
    
    // Create verification request
    const { error: requestError } = await supabase
      .from('verification_requests')
      .insert({
        user_id: userId,
        type: 'social',
        status: 'approved', // Auto-approve for demo
        created_at: new Date().toISOString(),
      });
      
    if (requestError) throw requestError;
    
    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_social_connected: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (updateError) throw updateError;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error connecting social account:', error);
    return { success: false, error: error.message };
  }
}; 