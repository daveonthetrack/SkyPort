-- Add metadata column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the metadata column
COMMENT ON COLUMN messages.metadata IS 'Additional metadata for messages (e.g., image dimensions, file size, etc.)';

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS messages_metadata_idx ON messages USING GIN (metadata); 