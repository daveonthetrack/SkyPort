-- Quick check to see if DID columns exist
-- Run this in Supabase SQL Editor to verify migration

-- Check if columns exist in profiles table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('did_identifier', 'did_document', 'public_key', 'did_created_at', 'did_updated_at')
ORDER BY column_name;

-- Check if verifiable_credentials table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'verifiable_credentials';

-- Alternative: Just try to select from the columns
-- SELECT did_identifier, did_document FROM profiles LIMIT 1; 