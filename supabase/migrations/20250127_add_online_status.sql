-- Add online status columns to profiles table
-- This migration adds is_online and last_seen columns to support real-time presence

-- Add is_online column (defaults to false)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Add last_seen column for tracking when user was last active
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for better performance when querying online users
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);

-- Add comment explaining the columns
COMMENT ON COLUMN profiles.is_online IS 'Indicates if the user is currently online/active';
COMMENT ON COLUMN profiles.last_seen IS 'Timestamp of when the user was last seen active';

-- Optional: Create a function to update last_seen automatically
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to update last_seen on profile updates
-- DROP TRIGGER IF EXISTS trigger_update_last_seen ON profiles;
-- CREATE TRIGGER trigger_update_last_seen
--     BEFORE UPDATE ON profiles
--     FOR EACH ROW
--     EXECUTE FUNCTION update_last_seen(); 