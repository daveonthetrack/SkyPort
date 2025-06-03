-- Add DID-related columns to profiles table
-- Migration: Add Decentralized Identity support

-- Add DID columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS did_identifier TEXT,
ADD COLUMN IF NOT EXISTS did_document JSONB,
ADD COLUMN IF NOT EXISTS public_key TEXT,
ADD COLUMN IF NOT EXISTS did_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS did_updated_at TIMESTAMPTZ;

-- Create index on did_identifier for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_did_identifier ON profiles(did_identifier);

-- Create table for verifiable credentials
CREATE TABLE IF NOT EXISTS verifiable_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    issuer_did TEXT NOT NULL,
    subject_did TEXT NOT NULL,
    credential_data JSONB NOT NULL,
    proof JSONB,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for verifiable credentials
CREATE INDEX IF NOT EXISTS idx_vc_user_id ON verifiable_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_vc_issuer_did ON verifiable_credentials(issuer_did);
CREATE INDEX IF NOT EXISTS idx_vc_subject_did ON verifiable_credentials(subject_did);
CREATE INDEX IF NOT EXISTS idx_vc_credential_type ON verifiable_credentials(credential_type);

-- Enable RLS on verifiable_credentials table
ALTER TABLE verifiable_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for verifiable_credentials
CREATE POLICY "Users can view their own credentials" ON verifiable_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials" ON verifiable_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials" ON verifiable_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials" ON verifiable_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON COLUMN profiles.did_identifier IS 'Decentralized Identity identifier (did:ethr format)';
COMMENT ON COLUMN profiles.did_document IS 'DID Document containing public keys and service endpoints';
COMMENT ON COLUMN profiles.public_key IS 'Public key associated with the DID';
COMMENT ON COLUMN profiles.did_created_at IS 'Timestamp when DID was created';
COMMENT ON COLUMN profiles.did_updated_at IS 'Timestamp when DID was last updated';

COMMENT ON TABLE verifiable_credentials IS 'Stores verifiable credentials issued to or by users';
COMMENT ON COLUMN verifiable_credentials.credential_type IS 'Type of credential (e.g., EmailVerificationCredential)';
COMMENT ON COLUMN verifiable_credentials.issuer_did IS 'DID of the credential issuer';
COMMENT ON COLUMN verifiable_credentials.subject_did IS 'DID of the credential subject';
COMMENT ON COLUMN verifiable_credentials.credential_data IS 'The actual credential data and claims';
COMMENT ON COLUMN verifiable_credentials.proof IS 'Cryptographic proof of the credential'; 