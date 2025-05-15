import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: Linking.createURL('/verify-email'),
      },
    });
    
    if (error) throw error;
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