import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DIDKeyPair, didService, VerifiableCredential } from '../services/DIDService';
import { useAuth } from './AuthContext';

export interface DIDProfile {
  did: string;
  publicKey: string;
  didDocument: any;
  verifiableCredentials: VerifiableCredential[];
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DIDContextType {
  didProfile: DIDProfile | null;
  loading: boolean;
  error: string | null;
  
  // Core DID operations
  createDID: () => Promise<void>;
  hasDID: () => Promise<boolean>;
  deleteDID: () => Promise<void>;
  
  // Credential operations
  issueCredential: (credentialType: string[], credentialData: any) => Promise<VerifiableCredential>;
  getCredentials: () => Promise<VerifiableCredential[]>;
  verifyCredential: (credential: VerifiableCredential) => Promise<boolean>;
  
  // Migration and setup
  migrateToDID: () => Promise<void>;
  refreshDIDProfile: () => Promise<void>;
}

const DIDContext = createContext<DIDContextType | undefined>(undefined);

export function DIDProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [didProfile, setDIDProfile] = useState<DIDProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize DID profile when user logs in
  useEffect(() => {
    if (profile?.id) {
      initializeDIDProfile();
    } else {
      setDIDProfile(null);
    }
  }, [profile?.id]);

  const initializeDIDProfile = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Check if user already has a DID in the database
      const { data: existingDID, error: fetchError } = await supabase
        .from('profiles')
        .select('did_identifier, did_document, did_created_at, did_updated_at')
        .eq('id', profile.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingDID?.did_identifier) {
        // Load existing DID profile
        await loadDIDProfile(existingDID);
      } else {
        // Check if user has local DID keys
        const hasLocalDID = await didService.hasDIDKeyPair(profile.id);
        if (hasLocalDID) {
          // Sync local DID to database
          await syncLocalDIDToDatabase();
        }
        // If no DID exists, user can create one when needed
      }
    } catch (err) {
      console.error('Error initializing DID profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize DID profile');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const loadDIDProfile = async (didData: any) => {
    if (!profile?.id) return;

    try {
      // Get credentials from database
      const { data: credentials, error: credError } = await supabase
        .from('verifiable_credentials')
        .select('*')
        .eq('user_id', profile.id);

      if (credError) {
        console.error('Error loading credentials:', credError);
      }

      const didProfile: DIDProfile = {
        did: didData.did_identifier,
        publicKey: '', // Will be loaded from keychain if needed
        didDocument: didData.did_document,
        verifiableCredentials: credentials || [],
        isVerified: (credentials?.length ?? 0) > 0,
        createdAt: didData.did_created_at,
        updatedAt: didData.did_updated_at,
      };

      setDIDProfile(didProfile);
    } catch (err) {
      console.error('Error loading DID profile:', err);
      throw err;
    }
  };

  const syncLocalDIDToDatabase = async () => {
    if (!profile?.id) return;

    try {
      const keyPair = await didService.retrieveDIDKeyPair(profile.id);
      if (!keyPair) return;

      const didDocument = didService.createDIDDocument(keyPair.did, keyPair.publicKey);

      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({
          did_identifier: keyPair.did,
          did_document: didDocument,
          public_key: keyPair.publicKey,
          did_created_at: new Date().toISOString(),
          did_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      await loadDIDProfile({
        did_identifier: keyPair.did,
        did_document: didDocument,
        did_created_at: new Date().toISOString(),
        did_updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error syncing local DID:', err);
      throw err;
    }
  };

  const createDID = async () => {
    if (!profile?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      // Generate new DID key pair
      const keyPair = await didService.generateDIDKeyPair();
      
      // Store securely on device
      await didService.storeDIDKeyPair(profile.id, keyPair);
      
      // Create DID document
      const didDocument = didService.createDIDDocument(keyPair.did, keyPair.publicKey);
      
      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({
          did_identifier: keyPair.did,
          did_document: didDocument,
          public_key: keyPair.publicKey,
          did_created_at: new Date().toISOString(),
          did_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Issue initial credentials based on existing verification status
      await issueInitialCredentials(keyPair);

      // Load the new DID profile
      await loadDIDProfile({
        did_identifier: keyPair.did,
        did_document: didDocument,
        did_created_at: new Date().toISOString(),
        did_updated_at: new Date().toISOString(),
      });

      console.log('✅ DID created successfully:', keyPair.did);
    } catch (err) {
      console.error('Error creating DID:', err);
      setError(err instanceof Error ? err.message : 'Failed to create DID');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const issueInitialCredentials = async (keyPair: DIDKeyPair) => {
    if (!profile) return;

    try {
      const credentials: VerifiableCredential[] = [];

      // Email verification credential
      if (profile.is_email_verified) {
        const emailCredential = await didService.createVerifiableCredential(
          keyPair.did,
          keyPair.did,
          {
            email: user?.email,
            verified_at: new Date().toISOString(),
            verification_method: 'email_confirmation',
          },
          ['EmailVerificationCredential'],
          profile.id
        );
        credentials.push(emailCredential);
      }

      // Phone verification credential
      if (profile.is_phone_verified) {
        const phoneCredential = await didService.createVerifiableCredential(
          keyPair.did,
          keyPair.did,
          {
            phone_number: profile.phone_number,
            verified_at: new Date().toISOString(),
            verification_method: 'sms_confirmation',
          },
          ['PhoneVerificationCredential'],
          profile.id
        );
        credentials.push(phoneCredential);
      }

      // Trust level credential
      if (profile.trust_level > 0) {
        const trustCredential = await didService.createVerifiableCredential(
          keyPair.did,
          keyPair.did,
          {
            trust_level: profile.trust_level,
            completed_deliveries: profile.completed_deliveries || 0,
            calculated_at: new Date().toISOString(),
            valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          },
          ['TrustLevelCredential'],
          profile.id
        );
        credentials.push(trustCredential);
      }

      // Save credentials to database
      for (const credential of credentials) {
        await saveCredentialToDatabase(credential);
      }
    } catch (err) {
      console.error('Error issuing initial credentials:', err);
    }
  };

  const saveCredentialToDatabase = async (credential: VerifiableCredential) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('verifiable_credentials')
        .insert({
          user_id: profile.id,
          credential_type: credential.type.join(','),
          issuer_did: credential.issuer,
          subject_did: credential.credentialSubject.id,
          credential_data: credential.credentialSubject,
          proof: credential.proof,
          issued_at: credential.issuanceDate,
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving credential to database:', err);
      throw err;
    }
  };

  const hasDID = async (): Promise<boolean> => {
    if (!profile?.id) return false;
    
    try {
      // Check both database and local storage
      const { data } = await supabase
        .from('profiles')
        .select('did_identifier')
        .eq('id', profile.id)
        .single();

      const hasLocalDID = await didService.hasDIDKeyPair(profile.id);
      
      return !!data?.did_identifier || hasLocalDID;
    } catch (err) {
      console.error('Error checking DID existence:', err);
      return false;
    }
  };

  const deleteDID = async () => {
    if (!profile?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      // Delete from device keychain (handle error gracefully)
      try {
        await didService.deleteDIDKeyPair(profile.id);
      } catch (keychainError) {
        console.warn('Error deleting from keychain:', keychainError);
      }

      // Delete from database
      const { error } = await supabase
        .from('profiles')
        .update({
          did_identifier: null,
          did_document: null,
          public_key: null,
          did_created_at: null,
          did_updated_at: null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Delete associated credentials
      await supabase
        .from('verifiable_credentials')
        .delete()
        .eq('user_id', profile.id);

      setDIDProfile(null);
      console.log('✅ DID deleted successfully');
    } catch (err) {
      console.error('Error deleting DID:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete DID');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const issueCredential = async (credentialType: string[], credentialData: any): Promise<VerifiableCredential> => {
    if (!profile?.id || !didProfile) {
      throw new Error('DID not available');
    }

    try {
      const credential = await didService.createVerifiableCredential(
        didProfile.did,
        didProfile.did,
        credentialData,
        credentialType,
        profile.id
      );

      await saveCredentialToDatabase(credential);
      await refreshDIDProfile();

      return credential;
    } catch (err) {
      console.error('Error issuing credential:', err);
      throw err;
    }
  };

  const getCredentials = async (): Promise<VerifiableCredential[]> => {
    if (!profile?.id) return [];

    try {
      const { data, error } = await supabase
        .from('verifiable_credentials')
        .select('*')
        .eq('user_id', profile.id);

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('Error getting credentials:', err);
      return [];
    }
  };

  const verifyCredential = async (credential: VerifiableCredential): Promise<boolean> => {
    try {
      return await didService.verifyCredential(credential);
    } catch (err) {
      console.error('Error verifying credential:', err);
      return false;
    }
  };

  const migrateToDID = async () => {
    if (!profile?.id) {
      throw new Error('User not authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const hasExistingDID = await hasDID();
      if (hasExistingDID) {
        console.log('User already has a DID');
        return;
      }

      await createDID();
      console.log('✅ Migration to DID completed');
    } catch (err) {
      console.error('Error migrating to DID:', err);
      setError(err instanceof Error ? err.message : 'Failed to migrate to DID');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refreshDIDProfile = async () => {
    if (!profile?.id) return;

    try {
      await initializeDIDProfile();
    } catch (err) {
      console.error('Error refreshing DID profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh DID profile');
    }
  };

  const value: DIDContextType = {
    didProfile,
    loading,
    error,
    createDID,
    hasDID,
    deleteDID,
    issueCredential,
    getCredentials,
    verifyCredential,
    migrateToDID,
    refreshDIDProfile,
  };

  return <DIDContext.Provider value={value}>{children}</DIDContext.Provider>;
}

export function useDID() {
  const context = useContext(DIDContext);
  if (context === undefined) {
    throw new Error('useDID must be used within a DIDProvider');
  }
  return context;
} 