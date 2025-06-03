import AsyncStorage from '@react-native-async-storage/async-storage';
import { Resolver } from 'did-resolver';
import { ethers } from 'ethers';
import { getResolver as getEthrResolver } from 'ethr-did-resolver';
import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';

// Types
export interface DIDDocument {
  '@context': string[];
  id: string;
  publicKey: PublicKey[];
  authentication: string[];
  service?: ServiceEndpoint[];
}

export interface PublicKey {
  id: string;
  type: string;
  controller: string;
  publicKeyHex?: string;
  publicKeyBase64?: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DIDKeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
  did: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: any;
  proof?: any;
}

// DID Service Class
export class DIDService {
  private resolver: Resolver;
  private networkName: string;
  private registryAddress: string;

  constructor(networkName: string = 'sepolia', registryAddress?: string) {
    this.networkName = networkName;
    this.registryAddress = registryAddress || '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B'; // Sepolia registry
    
    // Initialize DID resolver
    const ethrResolver = getEthrResolver({
      networks: [
        {
          name: this.networkName,
          registry: this.registryAddress,
          rpcUrl: this.getRpcUrl(networkName),
        },
      ],
    });
    
    this.resolver = new Resolver(ethrResolver);
  }

  private getRpcUrl(network: string): string {
    const rpcUrls: { [key: string]: string } = {
      mainnet: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      sepolia: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      goerli: 'https://goerli.infura.io/v3/YOUR_PROJECT_ID',
      polygon: 'https://polygon-rpc.com',
      polygonMumbai: 'https://rpc-mumbai.maticvigil.com',
    };
    
    return rpcUrls[network] || rpcUrls.sepolia;
  }

  private async isKeychainAvailable(): Promise<boolean> {
    try {
      // Test if keychain is available
      if (!Keychain || typeof Keychain.getInternetCredentials !== 'function') {
        console.warn('Keychain module not properly loaded');
        return false;
      }

      // Try a simple operation to test if keychain is working
      await Keychain.getInternetCredentials('test_availability_check_' + Date.now());
      return true;
    } catch (error: any) {
      // Check for the specific error we're seeing
      if (error?.message?.includes('getInternetCredentialsForServer') || 
          error?.message?.includes('Cannot read property') ||
          error?.message?.includes('null')) {
        console.warn('Keychain native module not properly initialized, using AsyncStorage fallback');
        return false;
      }
      
      // Other errors (like "not found") are expected and mean keychain is working
      console.log('Keychain is available (test key not found, which is expected)');
      return true;
    }
  }

  /**
   * Generate a new DID key pair
   */
  async generateDIDKeyPair(): Promise<DIDKeyPair> {
    try {
      console.log('🔑 Starting DID key pair generation...');
      
      // Check if ethers is available
      if (!ethers || !ethers.Wallet) {
        console.error('❌ Ethers library not available');
        throw new Error('Ethers library not properly loaded');
      }
      
      console.log('✅ Ethers library loaded successfully');
      
      // Check if random number generation is working
      console.log('🎲 Testing random number generation...');
      const testBuffer = new Uint8Array(32);
      
      // Use global crypto if available, otherwise skip test
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(testBuffer);
        console.log('✅ Random number generation working');
      } else {
        console.warn('⚠️ Crypto.getRandomValues not available, continuing with ethers random generation');
      }
      
      // Generate a new Ethereum wallet
      console.log('🏗️ Creating new Ethereum wallet...');
      let wallet;
      
      try {
        wallet = ethers.Wallet.createRandom();
        console.log('✅ Wallet created successfully');
      } catch (walletError: any) {
        console.warn('⚠️ ethers.Wallet.createRandom() failed, trying alternative method:', walletError?.message);
        
        // Fallback: create wallet from random private key
        try {
          // Generate a random 32-byte private key
          const privateKeyBytes = new Uint8Array(32);
          if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(privateKeyBytes);
          } else {
            // Fallback random generation
            for (let i = 0; i < 32; i++) {
              privateKeyBytes[i] = Math.floor(Math.random() * 256);
            }
          }
          
          // Convert to hex string
          const privateKeyHex = '0x' + Array.from(privateKeyBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          
          wallet = new ethers.Wallet(privateKeyHex);
          console.log('✅ Wallet created with fallback method');
        } catch (fallbackError: any) {
          console.error('❌ Both wallet creation methods failed:', fallbackError?.message);
          throw new Error(`Wallet creation failed: ${walletError?.message || fallbackError?.message}`);
        }
      }
      
      // Validate wallet properties
      if (!wallet.privateKey || !wallet.signingKey?.publicKey || !wallet.address) {
        console.error('❌ Wallet missing required properties:', {
          hasPrivateKey: !!wallet.privateKey,
          hasPublicKey: !!wallet.signingKey?.publicKey,
          hasAddress: !!wallet.address
        });
        throw new Error('Generated wallet is incomplete');
      }
      
      console.log('✅ Wallet validation passed');
      
      const keyPair: DIDKeyPair = {
        privateKey: wallet.privateKey,
        publicKey: wallet.signingKey.publicKey,
        address: wallet.address,
        did: `did:ethr:${this.networkName}:${wallet.address}`,
      };

      console.log('✅ DID key pair generated successfully:', {
        address: keyPair.address,
        did: keyPair.did,
        hasPrivateKey: !!keyPair.privateKey,
        hasPublicKey: !!keyPair.publicKey
      });

      return keyPair;
    } catch (error: any) {
      console.error('❌ Error generating DID key pair:', {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        ethersAvailable: !!ethers,
        walletAvailable: !!(ethers && ethers.Wallet)
      });
      throw new Error(`Failed to generate DID key pair: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Store DID key pair securely in device keychain
   */
  async storeDIDKeyPair(userId: string, keyPair: DIDKeyPair): Promise<void> {
    try {
      const keychainKey = `skyport_did_${userId}`;
      const keyData = {
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        address: keyPair.address,
      };

      const isKeychainReady = await this.isKeychainAvailable();
      
      if (isKeychainReady) {
        // Use secure keychain if available
        await Keychain.setInternetCredentials(
          keychainKey, 
          keyPair.did, 
          JSON.stringify(keyData)
        );
        console.log('DID key pair stored securely in keychain');
      } else {
        // Fallback to AsyncStorage with warning
        console.warn('Using AsyncStorage fallback for DID storage - less secure');
        await AsyncStorage.setItem(keychainKey, JSON.stringify({
          did: keyPair.did,
          ...keyData
        }));
        console.log('DID key pair stored in AsyncStorage');
      }
    } catch (error) {
      console.error('Error storing DID key pair:', error);
      throw new Error('Failed to store DID key pair securely');
    }
  }

  /**
   * Retrieve DID key pair from device keychain
   */
  async retrieveDIDKeyPair(userId: string): Promise<DIDKeyPair | null> {
    try {
      const keychainKey = `skyport_did_${userId}`;
      
      const isKeychainReady = await this.isKeychainAvailable();
      
      if (isKeychainReady) {
        // Try to get from keychain first
        const credentials = await Keychain.getInternetCredentials(keychainKey);
        
        if (credentials && 'username' in credentials) {
          const keyData = JSON.parse(credentials.password);
          
          return {
            privateKey: keyData.privateKey,
            publicKey: keyData.publicKey,
            address: keyData.address,
            did: credentials.username,
          };
        }
      } else {
        // Fallback to AsyncStorage
        const storedData = await AsyncStorage.getItem(keychainKey);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          return {
            privateKey: parsedData.privateKey,
            publicKey: parsedData.publicKey,
            address: parsedData.address,
            did: parsedData.did,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving DID key pair:', error);
      return null;
    }
  }

  /**
   * Create a basic DID document
   */
  createDIDDocument(did: string, publicKey: string): DIDDocument {
    const publicKeyId = `${did}#owner`;
    
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1recovery-2020/v2',
      ],
      id: did,
      publicKey: [
        {
          id: publicKeyId,
          type: 'Secp256k1VerificationKey2018',
          controller: did,
          publicKeyHex: publicKey.slice(2), // Remove '0x' prefix
        },
      ],
      authentication: [publicKeyId],
      service: [
        {
          id: `${did}#skyport`,
          type: 'SkyPortProfile',
          serviceEndpoint: 'https://skyport.app/profile',
        },
      ],
    };
  }

  /**
   * Resolve a DID to get its document
   */
  async resolveDID(did: string): Promise<DIDDocument | null> {
    try {
      const result = await this.resolver.resolve(did);
      
      if (result.didResolutionMetadata.error) {
        console.error('DID resolution error:', result.didResolutionMetadata.error);
        return null;
      }

      return result.didDocument as DIDDocument;
    } catch (error) {
      console.error('Error resolving DID:', error);
      return null;
    }
  }

  /**
   * Sign data with DID private key
   */
  async signWithDID(userId: string, data: string): Promise<string> {
    try {
      const keyPair = await this.retrieveDIDKeyPair(userId);
      if (!keyPair) {
        throw new Error('DID key pair not found');
      }

      const wallet = new ethers.Wallet(keyPair.privateKey);
      const signature = await wallet.signMessage(data);

      return signature;
    } catch (error) {
      console.error('Error signing with DID:', error);
      throw new Error('Failed to sign data with DID');
    }
  }

  /**
   * Verify a signature against a DID
   */
  async verifyDIDSignature(did: string, data: string, signature: string): Promise<boolean> {
    try {
      // Extract address from DID
      const addressMatch = did.match(/did:ethr:(?:\w+:)?0x([a-fA-F0-9]{40})$/);
      if (!addressMatch) {
        throw new Error('Invalid DID format');
      }

      const expectedAddress = `0x${addressMatch[1]}`;
      const recoveredAddress = ethers.verifyMessage(data, signature);

      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Error verifying DID signature:', error);
      return false;
    }
  }

  /**
   * Create a verifiable credential
   */
  async createVerifiableCredential(
    issuerDID: string,
    subjectDID: string,
    credentialData: any,
    credentialType: string[],
    userId: string
  ): Promise<VerifiableCredential> {
    try {
      const credential: VerifiableCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://skyport.app/credentials/v1',
        ],
        id: `https://skyport.app/credentials/${Date.now()}`,
        type: ['VerifiableCredential', ...credentialType],
        issuer: issuerDID,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: subjectDID,
          ...credentialData,
        },
      };

      // Sign the credential
      const credentialString = JSON.stringify(credential);
      const signature = await this.signWithDID(userId, credentialString);

      credential.proof = {
        type: 'EcdsaSecp256k1Signature2019',
        created: new Date().toISOString(),
        verificationMethod: `${issuerDID}#owner`,
        proofPurpose: 'assertionMethod',
        jws: signature,
      };

      return credential;
    } catch (error) {
      console.error('Error creating verifiable credential:', error);
      throw new Error('Failed to create verifiable credential');
    }
  }

  /**
   * Verify a verifiable credential
   */
  async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    try {
      if (!credential.proof) {
        return false;
      }

      // Remove proof for verification
      const { proof, ...credentialWithoutProof } = credential;
      const credentialString = JSON.stringify(credentialWithoutProof);

      return await this.verifyDIDSignature(
        credential.issuer,
        credentialString,
        proof.jws
      );
    } catch (error) {
      console.error('Error verifying credential:', error);
      return false;
    }
  }

  /**
   * Delete DID key pair from keychain
   */
  async deleteDIDKeyPair(userId: string): Promise<void> {
    try {
      const keychainKey = `skyport_did_${userId}`;
      
      const isKeychainReady = await this.isKeychainAvailable();
      
      if (isKeychainReady) {
        // Try to get the credentials first to check if they exist
        const credentials = await Keychain.getInternetCredentials(keychainKey);
        if (credentials && 'username' in credentials) {
          // Clear by setting empty credentials, then reset
          await Keychain.setInternetCredentials(keychainKey, '', '');
        }
      } else {
        // Remove from AsyncStorage
        await AsyncStorage.removeItem(keychainKey);
      }
      
      console.log('DID key pair deleted successfully');
    } catch (error) {
      console.error('Error deleting DID key pair:', error);
      // Don't throw error for deletion, as it might not exist
      console.log('DID key pair deletion completed (may not have existed)');
    }
  }

  /**
   * Check if user has a DID key pair
   */
  async hasDIDKeyPair(userId: string): Promise<boolean> {
    try {
      const keyPair = await this.retrieveDIDKeyPair(userId);
      return keyPair !== null;
    } catch (error) {
      console.error('Error checking DID key pair:', error);
      return false;
    }
  }

  /**
   * Get user profile with DID information
   */
  async getUserProfile(userId: string): Promise<{ did_identifier?: string } | null> {
    try {
      const keyPair = await this.retrieveDIDKeyPair(userId);
      if (keyPair) {
        return { did_identifier: keyPair.did };
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Create DID for user (combines generation and storage)
   */
  async createDIDForUser(userId: string): Promise<{ success: boolean; error?: string; did?: string }> {
    try {
      // Check if user already has a DID
      const existingKeyPair = await this.retrieveDIDKeyPair(userId);
      if (existingKeyPair) {
        return {
          success: true,
          did: existingKeyPair.did
        };
      }

      // Generate new DID key pair
      const keyPair = await this.generateDIDKeyPair();
      
      // Store the key pair
      await this.storeDIDKeyPair(userId, keyPair);
      
      console.log('✅ DID created for user:', { userId, did: keyPair.did });
      
      return {
        success: true,
        did: keyPair.did
      };
    } catch (error: any) {
      console.error('❌ Error creating DID for user:', error);
      return {
        success: false,
        error: error?.message || 'Failed to create DID'
      };
    }
  }
}

// Singleton instance
export const didService = new DIDService(); 