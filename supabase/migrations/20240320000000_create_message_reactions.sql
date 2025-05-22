-- Add status column to messages table
ALTER TABLE messages
ADD COLUMN status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read'));

-- Create message_reactions table
CREATE TABLE message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, reaction)
);

-- Add RLS policies
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions for messages they can see"
  ON message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can add reactions to messages they can see"
  ON message_reactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
      AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their own reactions"
  ON message_reactions
  FOR DELETE
  USING (user_id = auth.uid()); 