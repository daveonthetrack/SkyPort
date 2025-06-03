import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useDID } from '../contexts/DIDContext';

const DIDOnboardingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { didProfile, loading, error, createDID, hasDID, migrateToDID, getCredentials } = useDID();
  const { profile } = useAuth();
  const [hasExistingDID, setHasExistingDID] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<any[]>([]);

  useEffect(() => {
    checkDIDStatus();
  }, []);

  useEffect(() => {
    if (didProfile) {
      loadCredentials();
    }
  }, [didProfile]);

  const checkDIDStatus = async () => {
    try {
      const exists = await hasDID();
      setHasExistingDID(exists);
    } catch (err) {
      console.error('Error checking DID status:', err);
    }
  };

  const loadCredentials = async () => {
    try {
      const creds = await getCredentials();
      setCredentials(creds);
    } catch (err) {
      console.error('Error loading credentials:', err);
    }
  };

  const handleCreateDID = async () => {
    try {
      await createDID();
      setHasExistingDID(true);
      Alert.alert(
        'Success!',
        'Your decentralized identity has been created successfully. You now have enhanced privacy and security features.',
        [{ text: 'Great!' }]
      );
    } catch (err) {
      Alert.alert(
        'Error',
        'Failed to create DID. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMigrateToDID = async () => {
    Alert.alert(
      'Migrate to DID',
      'This will create a decentralized identity and migrate your existing verifications. This process is optional but recommended for enhanced security.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            try {
              await migrateToDID();
              setHasExistingDID(true);
              Alert.alert('Success!', 'Migration completed successfully!');
            } catch (err) {
              Alert.alert('Error', 'Migration failed. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderBenefits = () => (
    <View style={styles.benefitsContainer}>
      <Text style={styles.sectionTitle}>Benefits of Decentralized Identity</Text>
      
      <View style={styles.benefitItem}>
        <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>Enhanced Security</Text>
          <Text style={styles.benefitDescription}>
            Your identity is secured by cryptographic keys that only you control
          </Text>
        </View>
      </View>

      <View style={styles.benefitItem}>
        <Ionicons name="person-circle" size={24} color="#2196F3" />
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>Self-Sovereign Identity</Text>
          <Text style={styles.benefitDescription}>
            You own and control your identity data, not any centralized authority
          </Text>
        </View>
      </View>

      <View style={styles.benefitItem}>
        <Ionicons name="globe" size={24} color="#FF9800" />
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>Portable Reputation</Text>
          <Text style={styles.benefitDescription}>
            Your trust score and verifications can be used across platforms
          </Text>
        </View>
      </View>

      <View style={styles.benefitItem}>
        <Ionicons name="eye-off" size={24} color="#9C27B0" />
        <View style={styles.benefitText}>
          <Text style={styles.benefitTitle}>Privacy Protection</Text>
          <Text style={styles.benefitDescription}>
            Share only what you choose to share with selective disclosure
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDIDInfo = () => {
    if (!didProfile) return null;

    return (
      <View style={styles.didInfoContainer}>
        <Text style={styles.sectionTitle}>Your Decentralized Identity</Text>
        
        <View style={styles.didCard}>
          <View style={styles.didHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.didStatusText}>DID Active</Text>
          </View>
          
          <View style={styles.didDetail}>
            <Text style={styles.didLabel}>DID Identifier:</Text>
            <Text style={styles.didValue} numberOfLines={1} ellipsizeMode="middle">
              {didProfile.did}
            </Text>
          </View>

          <View style={styles.didDetail}>
            <Text style={styles.didLabel}>Created:</Text>
            <Text style={styles.didValue}>
              {new Date(didProfile.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.didDetail}>
            <Text style={styles.didLabel}>Verifiable Credentials:</Text>
            <Text style={styles.didValue}>
              {credentials.length} credential{credentials.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {credentials.length > 0 && (
          <View style={styles.credentialsContainer}>
            <Text style={styles.credentialsTitle}>Your Credentials</Text>
            {credentials.map((credential, index) => (
              <View key={index} style={styles.credentialCard}>
                <View style={styles.credentialHeader}>
                  <Ionicons name="ribbon" size={20} color="#2196F3" />
                  <Text style={styles.credentialType}>
                    {credential.credential_type.replace('Credential', '').replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                </View>
                <Text style={styles.credentialDate}>
                  Issued: {new Date(credential.issued_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderActions = () => {
    if (hasExistingDID === null || loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Checking DID status...</Text>
        </View>
      );
    }

    if (didProfile) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadCredentials}>
            <Ionicons name="refresh" size={20} color="#2196F3" />
            <Text style={styles.secondaryButtonText}>Refresh Credentials</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasExistingDID) {
      return (
        <View style={styles.actionsContainer}>
          <Text style={styles.infoText}>
            You have a DID but it's not fully loaded. Please restart the app or check your connection.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCreateDID} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.primaryButtonText}>Create My DID</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleMigrateToDID} disabled={loading}>
          <Ionicons name="arrow-forward-circle" size={20} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Migrate Existing Profile</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimerText}>
          Creating a DID is optional but recommended for enhanced security and privacy.
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Decentralized Identity</Text>
        <Text style={styles.subtitle}>
          Take control of your digital identity with blockchain technology
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={20} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {didProfile ? renderDIDInfo() : renderBenefits()}
      {renderActions()}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your private keys are stored securely on your device and never shared with anyone.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  benefitsContainer: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  didInfoContainer: {
    padding: 24,
  },
  didCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  didHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  didStatusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 8,
  },
  didDetail: {
    marginBottom: 12,
  },
  didLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  didValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  credentialsContainer: {
    marginTop: 8,
  },
  credentialsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  credentialCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  credentialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  credentialType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  credentialDate: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    padding: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 8,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 16,
    margin: 24,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default DIDOnboardingScreen; 