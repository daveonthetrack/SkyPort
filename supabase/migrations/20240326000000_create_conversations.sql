-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS public.conversations
    DROP CONSTRAINT IF EXISTS conversations_user1_id_fkey,
    DROP CONSTRAINT IF EXISTS conversations_user2_id_fkey;

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_id UUID NOT NULL,
    user2_id UUID NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT conversations_users_check CHECK (user1_id != user2_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS conversations_user1_id_idx ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS conversations_user2_id_idx ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations(updated_at);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own conversations"
    ON public.conversations
    FOR SELECT
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert their own conversations"
    ON public.conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their own conversations"
    ON public.conversations
    FOR UPDATE
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraints with specific names
ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_user1_id_fkey
    FOREIGN KEY (user1_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_user2_id_fkey
    FOREIGN KEY (user2_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE; 