-- Simple migration to create only the missing storage buckets
-- This avoids policy conflicts and focuses on the immediate issue

-- Create storage buckets (safe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('items', 'items', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_audio', 'chat_audio', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verifications', 'verifications', false)
ON CONFLICT (id) DO NOTHING;

-- Create basic storage policies for items bucket
DO $$
BEGIN
    -- Drop and recreate items bucket policies
    DROP POLICY IF EXISTS "items_upload_policy" ON storage.objects;
    DROP POLICY IF EXISTS "items_view_policy" ON storage.objects;
    
    CREATE POLICY "items_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'items' AND
      auth.uid() IS NOT NULL
    );

    CREATE POLICY "items_view_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'items');
    
EXCEPTION WHEN OTHERS THEN
    -- If policies already exist with different names, that's okay
    NULL;
END $$;

-- Create basic storage policies for avatars bucket
DO $$
BEGIN
    -- Drop and recreate avatars bucket policies
    DROP POLICY IF EXISTS "avatars_upload_policy" ON storage.objects;
    DROP POLICY IF EXISTS "avatars_view_policy" ON storage.objects;
    
    CREATE POLICY "avatars_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars' AND
      auth.uid() IS NOT NULL
    );

    CREATE POLICY "avatars_view_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
    
EXCEPTION WHEN OTHERS THEN
    -- If policies already exist with different names, that's okay
    NULL;
END $$;

-- Create basic storage policies for chat_images bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "chat_images_upload_policy" ON storage.objects;
    DROP POLICY IF EXISTS "chat_images_view_policy" ON storage.objects;
    
    CREATE POLICY "chat_images_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'chat_images' AND
      auth.uid() IS NOT NULL
    );

    CREATE POLICY "chat_images_view_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat_images');
    
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create basic storage policies for chat_audio bucket
DO $$
BEGIN
    DROP POLICY IF EXISTS "chat_audio_upload_policy" ON storage.objects;
    DROP POLICY IF EXISTS "chat_audio_view_policy" ON storage.objects;
    
    CREATE POLICY "chat_audio_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'chat_audio' AND
      auth.uid() IS NOT NULL
    );

    CREATE POLICY "chat_audio_view_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'chat_audio');
    
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Create basic storage policies for verifications bucket (private)
DO $$
BEGIN
    DROP POLICY IF EXISTS "verifications_upload_policy" ON storage.objects;
    DROP POLICY IF EXISTS "verifications_view_policy" ON storage.objects;
    
    CREATE POLICY "verifications_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'verifications' AND
      auth.uid() IS NOT NULL
    );

    CREATE POLICY "verifications_view_policy"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'verifications' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
    
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$; 