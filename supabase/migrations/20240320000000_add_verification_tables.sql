-- Create verification_requests table
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('id', 'phone', 'email', 'social')),
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add verification-related columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_id_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_social_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trust_level INTEGER DEFAULT 0;

-- Create function to update trust level
CREATE OR REPLACE FUNCTION update_trust_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.trust_level := 
    CASE 
      WHEN NEW.is_email_verified THEN 25 ELSE 0 END +
    CASE 
      WHEN NEW.is_phone_verified THEN 25 ELSE 0 END +
    CASE 
      WHEN NEW.is_id_verified THEN 30 ELSE 0 END +
    CASE 
      WHEN NEW.is_social_connected THEN 20 ELSE 0 END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update trust level
CREATE TRIGGER update_profile_trust_level
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_level();

-- Create RLS policies for verification_requests
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification requests"
  ON verification_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own verification requests"
  ON verification_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for verification documents
CREATE POLICY "Users can upload their own verification documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'verifications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own verification documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'verifications' AND
    auth.uid()::text = (storage.foldername(name))[1]
  ); 