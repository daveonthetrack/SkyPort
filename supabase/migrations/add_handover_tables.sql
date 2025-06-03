-- Add handover system tables for bike rental-style delivery verification
-- Migration: Add GPS + Photo + DID handover verification

-- Create storage bucket for handover photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'handover-photos',
  'handover-photos',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on handover-photos bucket
CREATE POLICY "Public read access for handover photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'handover-photos');

CREATE POLICY "Authenticated users can upload handover photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'handover-photos' AND auth.role() = 'authenticated');

-- Create handover events table
CREATE TABLE IF NOT EXISTS handover_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL,
    event_type TEXT CHECK (event_type IN ('pickup', 'delivery')) NOT NULL,
    user_did TEXT NOT NULL,
    gps_location GEOGRAPHY(POINT) NOT NULL,
    photo_url TEXT NOT NULL,
    verification_data JSONB NOT NULL,
    crypto_signature TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for handover events
CREATE INDEX IF NOT EXISTS idx_handover_events_package_id ON handover_events(package_id);
CREATE INDEX IF NOT EXISTS idx_handover_events_user_did ON handover_events(user_did);
CREATE INDEX IF NOT EXISTS idx_handover_events_type ON handover_events(event_type);
CREATE INDEX IF NOT EXISTS idx_handover_events_created ON handover_events(created_at);

-- Create automatic payment releases table
CREATE TABLE IF NOT EXISTS payment_releases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    package_id TEXT NOT NULL,
    trigger_event UUID REFERENCES handover_events(id),
    amount DECIMAL(10,2) DEFAULT 0,
    released_at TIMESTAMPTZ DEFAULT NOW(),
    auto_verified BOOLEAN DEFAULT TRUE
);

-- Create index for payment releases
CREATE INDEX IF NOT EXISTS idx_payment_releases_package_id ON payment_releases(package_id);

-- Enable RLS on handover events
ALTER TABLE handover_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view handover events for their packages
CREATE POLICY "Users can view handover events for their packages"
ON handover_events FOR SELECT
USING (
  user_did = (
    SELECT did_identifier 
    FROM profiles 
    WHERE id = auth.uid()
  ) OR
  -- Allow package owners to view events
  EXISTS (
    SELECT 1 FROM packages 
    WHERE packages.id::text = handover_events.package_id 
    AND packages.user_id = auth.uid()
  )
);

-- Policy: Authenticated users can create handover events
CREATE POLICY "Authenticated users can create handover events"
ON handover_events FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  user_did = (
    SELECT did_identifier 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Enable RLS on payment releases
ALTER TABLE payment_releases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view payment releases for their packages
CREATE POLICY "Users can view payment releases for their packages"
ON payment_releases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM packages 
    WHERE packages.id::text = payment_releases.package_id 
    AND (packages.user_id = auth.uid() OR packages.traveler_id = auth.uid())
  )
);

-- Policy: System can create payment releases
CREATE POLICY "System can create payment releases"
ON payment_releases FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE handover_events IS 'Stores GPS + Photo + DID verification events for package handovers';
COMMENT ON COLUMN handover_events.package_id IS 'Reference to the package being handed over';
COMMENT ON COLUMN handover_events.event_type IS 'Type of handover: pickup or delivery';
COMMENT ON COLUMN handover_events.user_did IS 'DID of the user performing the handover';
COMMENT ON COLUMN handover_events.gps_location IS 'GPS coordinates where handover occurred';
COMMENT ON COLUMN handover_events.photo_url IS 'URL of the handover verification photo';
COMMENT ON COLUMN handover_events.verification_data IS 'Complete verification data including signatures';
COMMENT ON COLUMN handover_events.crypto_signature IS 'DID signature of the verification data';
COMMENT ON COLUMN handover_events.verified IS 'Whether the handover was successfully verified';
COMMENT ON COLUMN handover_events.created_at IS 'Timestamp when the handover event was created';

COMMENT ON TABLE payment_releases IS 'Tracks automatic payment releases after successful delivery verification';
COMMENT ON COLUMN payment_releases.trigger_event IS 'The handover event that triggered payment release';
COMMENT ON COLUMN payment_releases.auto_verified IS 'Whether payment was released automatically';

-- Create packages table if it doesn't exist (for foreign key references)
CREATE TABLE IF NOT EXISTS packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    traveler_id UUID REFERENCES profiles(id),
    pickup_location TEXT NOT NULL,
    destination TEXT NOT NULL,
    size TEXT,
    weight DECIMAL(5,2),
    value DECIMAL(10,2),
    status TEXT DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on packages
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Basic policies for packages table
CREATE POLICY "Users can view public packages or their own packages"
ON packages FOR SELECT
USING (
  status = 'active' OR 
  user_id = auth.uid() OR 
  traveler_id = auth.uid()
);

CREATE POLICY "Users can create their own packages"
ON packages FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own packages"
ON packages FOR UPDATE
USING (user_id = auth.uid() OR traveler_id = auth.uid());

-- Add handover verification column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS handover_verification_enabled BOOLEAN DEFAULT FALSE;

-- Create index for better performance on handover verification queries
CREATE INDEX IF NOT EXISTS idx_items_handover_verification 
ON items(handover_verification_enabled); 