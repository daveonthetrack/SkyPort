-- Add handover verification column to items table
-- Run this in your Supabase SQL editor

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS handover_verification_enabled BOOLEAN DEFAULT FALSE;

-- Create index for better performance on handover verification queries
CREATE INDEX IF NOT EXISTS idx_items_handover_verification 
ON items(handover_verification_enabled);

-- Update any existing items to have handover verification disabled by default
UPDATE items 
SET handover_verification_enabled = FALSE 
WHERE handover_verification_enabled IS NULL; 