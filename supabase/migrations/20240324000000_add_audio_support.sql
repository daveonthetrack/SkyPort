-- Add audio_url column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add storage bucket for chat audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_audio', 'chat_audio', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for chat audio
CREATE POLICY "Users can upload chat audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat_audio' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view chat audio"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat_audio' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  )
);

-- Add index for audio_url
CREATE INDEX IF NOT EXISTS messages_audio_url_idx ON messages(audio_url); 