-- Add QR code fields to items table for package verification
-- Run this migration to add QR code storage capability

ALTER TABLE items ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS qr_signature TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMP WITH TIME ZONE;

-- Add index for QR code lookups
CREATE INDEX IF NOT EXISTS idx_items_qr_code_data ON items(qr_code_data);

-- Add comments for documentation
COMMENT ON COLUMN items.qr_code_data IS 'JSON string containing encrypted package verification data';
COMMENT ON COLUMN items.qr_signature IS 'Cryptographic signature of the QR code data';
COMMENT ON COLUMN items.qr_generated_at IS 'Timestamp when QR code was generated at pickup'; 