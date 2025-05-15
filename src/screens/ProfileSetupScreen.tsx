import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, ViewStyle, TextStyle } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

const ProfileSetupScreen = ({ navigation }: Props) => {
  const { session, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [areaCode, setAreaCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<'sender' | 'traveler' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
    role?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!areaCode || !phoneNumber) {
      newErrors.phone = 'Phone number is required';
    } else if (phoneNumber.length < 10) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (!role) {
      newErrors.role = 'Please select a role';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSetup = async () => {
    if (!validateForm()) return;

    if (!session?.user?.id) {
      Alert.alert('Error', 'No user session found. Please try signing in again.');
      return;
    }

    const formattedPhoneNumber = `+${areaCode}${phoneNumber}`;

    setLoading(true);
    try {
      // First, check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', fetchError);
        throw fetchError;
      }

      const profileData = {
        id: session.user.id,
        name: name.trim(),
        phone_number: formattedPhoneNumber,
        role,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existingProfile) {
        console.log('Updating existing profile:', existingProfile);
        result = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', session.user.id)
          .select()
          .single();
      } else {
        console.log('Creating new profile');
        result = await supabase
          .from('profiles')
          .insert([profileData])
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving profile:', result.error);
        throw result.error;
      }

      console.log('Profile saved successfully:', result.data);
      await refreshProfile();
      navigation.replace('MainApp');
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to setup profile. Please try again.',
        [{ text: 'OK', onPress: () => setLoading(false) }]
      );
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Let's get you started with Adera</Text>
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            placeholder="Enter your full name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            autoCapitalize="words"
            textContentType="name"
            editable={!loading}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneContainer}>
            <View style={[styles.areaCodeContainer, errors.phone ? styles.inputError : null]}>
              <Text style={styles.plusSign}>+</Text>
              <TextInput
                style={styles.areaCodeInput}
                placeholder="1"
                value={areaCode}
                onChangeText={(text) => {
                  setAreaCode(text.replace(/[^0-9]/g, ''));
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                keyboardType="number-pad"
                maxLength={3}
                editable={!loading}
              />
            </View>
            <TextInput
              style={[styles.phoneInput, errors.phone ? styles.inputError : null]}
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text.replace(/[^0-9]/g, ''));
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              keyboardType="number-pad"
              maxLength={10}
              textContentType="telephoneNumber"
              editable={!loading}
            />
          </View>
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Select Your Role</Text>
          {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === 'sender' && styles.selectedRole]}
              onPress={() => {
                setRole('sender');
                if (errors.role) setErrors({ ...errors, role: undefined });
              }}
              disabled={loading}
            >
              <Ionicons 
                name="cube-outline" 
                size={24} 
                color={role === 'sender' ? '#007bff' : '#666'} 
              />
              <Text style={[styles.roleText, role === 'sender' && styles.selectedRoleText]}>
                Sender
              </Text>
              <Text style={styles.roleDescription}>I want to send items</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleButton, role === 'traveler' && styles.selectedRole]}
              onPress={() => {
                setRole('traveler');
                if (errors.role) setErrors({ ...errors, role: undefined });
              }}
              disabled={loading}
            >
              <Ionicons 
                name="airplane-outline" 
                size={24} 
                color={role === 'traveler' ? '#007bff' : '#666'} 
              />
              <Text style={[styles.roleText, role === 'traveler' && styles.selectedRoleText]}>
                Traveler
              </Text>
              <Text style={styles.roleDescription}>I want to carry items</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.button, (!name || !areaCode || !phoneNumber || !role || loading) && styles.disabledButton]}
          onPress={handleProfileSetup}
          disabled={loading || !name || !areaCode || !phoneNumber || !role}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  } as ViewStyle,
  scrollView: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  } as ViewStyle,
  header: {
    marginBottom: 30,
    alignItems: 'center',
  } as ViewStyle,
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  } as TextStyle,
  formGroup: {
    marginBottom: 20,
  } as ViewStyle,
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  } as ViewStyle,
  inputError: {
    borderColor: '#dc3545',
  } as ViewStyle,
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  phoneContainer: {
    flexDirection: 'row',
  } as ViewStyle,
  areaCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 10,
  } as ViewStyle,
  plusSign: {
    fontSize: 16,
    marginRight: 2,
    color: '#666',
  } as TextStyle,
  areaCodeInput: {
    width: 50,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 0,
    backgroundColor: 'transparent',
  } as ViewStyle,
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  } as ViewStyle,
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  roleButton: {
    flex: 1,
    padding: 20,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  selectedRole: {
    borderColor: '#007bff',
    backgroundColor: '#e7f3ff',
  },
  roleText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#333',
  },
  selectedRoleText: {
    color: '#007bff',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#a0cfff',
  },
  signOutButton: {
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#dc3545',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ProfileSetupScreen; 