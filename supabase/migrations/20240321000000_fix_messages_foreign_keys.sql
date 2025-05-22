-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Add proper foreign key constraints
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS messages_item_id_idx ON messages(item_id);
CREATE INDEX IF NOT EXISTS messages_trip_id_idx ON messages(trip_id);

-- Update RLS policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
  );

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
  )
  WITH CHECK (
    auth.uid() = sender_id
  );

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE
  USING (
    auth.uid() = sender_id
  ); 