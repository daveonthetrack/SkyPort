-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  size TEXT CHECK (size IN ('small', 'medium', 'large')) NOT NULL DEFAULT 'medium',
  pickup_location TEXT NOT NULL,
  destination TEXT NOT NULL,
  image_url TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'in_transit', 'delivered', 'cancelled')) NOT NULL DEFAULT 'pending',
  traveler_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create trips table
CREATE TABLE IF NOT EXISTS trips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  departure_location TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date TIMESTAMP WITH TIME ZONE NOT NULL,
  arrival_date TIMESTAMP WITH TIME ZONE,
  available_space TEXT CHECK (available_space IN ('small', 'medium', 'large')) NOT NULL DEFAULT 'medium',
  description TEXT,
  status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
  is_verified BOOLEAN DEFAULT FALSE,
  verification_url TEXT,
  verification_type TEXT,
  verification_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('items', 'items', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for avatar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for item images
CREATE POLICY "Users can upload item images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'items' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'items');

CREATE POLICY "Users can update their own item images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'items' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own item images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'items' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policies for avatar images
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS on tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for items
CREATE POLICY "Users can view all items"
ON items FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own items"
ON items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items"
ON items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items"
ON items FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for trips
CREATE POLICY "Users can view all trips"
ON trips FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own trips"
ON trips FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
ON trips FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
ON trips FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS items_user_id_idx ON items(user_id);
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);
CREATE INDEX IF NOT EXISTS items_created_at_idx ON items(created_at);
CREATE INDEX IF NOT EXISTS trips_user_id_idx ON trips(user_id);
CREATE INDEX IF NOT EXISTS trips_status_idx ON trips(status);
CREATE INDEX IF NOT EXISTS trips_departure_date_idx ON trips(departure_date); 