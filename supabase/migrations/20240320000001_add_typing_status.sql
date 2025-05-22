-- Create typing_status table
CREATE TABLE IF NOT EXISTS typing_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    other_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, other_user_id)
);

-- Add RLS policies
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

-- Allow users to view typing status of users they're chatting with
CREATE POLICY "Users can view typing status of chat partners"
    ON typing_status
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        auth.uid() = other_user_id
    );

-- Allow users to update their own typing status
CREATE POLICY "Users can update their own typing status"
    ON typing_status
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow users to insert their own typing status
CREATE POLICY "Users can insert their own typing status"
    ON typing_status
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS typing_status_user_id_idx ON typing_status(user_id);
CREATE INDEX IF NOT EXISTS typing_status_other_user_id_idx ON typing_status(other_user_id); 