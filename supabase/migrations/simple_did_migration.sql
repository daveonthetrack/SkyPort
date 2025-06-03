-- Simple DID Migration - Essential columns only
-- Run this if the full migration didn't work

-- Add DID columns to profiles table (one by one for safety)
ALTER TABLE profiles ADD COLUMN did_identifier TEXT;
ALTER TABLE profiles ADD COLUMN did_document JSONB;
ALTER TABLE profiles ADD COLUMN public_key TEXT;
ALTER TABLE profiles ADD COLUMN did_created_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN did_updated_at TIMESTAMPTZ;

-- Create verifiable credentials table
CREATE TABLE verifiable_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    issuer_did TEXT NOT NULL,
    subject_did TEXT NOT NULL,
    credential_data JSONB NOT NULL,
    proof JSONB,
    issued_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE verifiable_credentials ENABLE ROW LEVEL SECURITY;

-- Basic RLS policy
CREATE POLICY "Users manage own credentials" ON verifiable_credentials
    USING (auth.uid() = user_id); 