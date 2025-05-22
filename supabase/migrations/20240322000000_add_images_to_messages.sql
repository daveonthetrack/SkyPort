-- Add image_url column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for chat images
CREATE POLICY "Users can upload chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat_images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat_images' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  )
);

-- Add index for image_url
CREATE INDEX IF NOT EXISTS messages_image_url_idx ON messages(image_url); 