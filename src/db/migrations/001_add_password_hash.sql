-- Add password_hash column to profiles table
-- Supabase managed auth internally; we now store hashed passwords ourselves.
-- Run this AFTER restoring your pg_dump from Supabase.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Index for email lookups (likely already exists from Supabase but ensure it)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles (email);

COMMENT ON COLUMN profiles.password_hash IS 'bcrypt hash of user password, managed by pact-backend';
