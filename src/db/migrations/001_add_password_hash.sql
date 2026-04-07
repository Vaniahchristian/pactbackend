-- Add password_hash column to profiles table
-- Supabase managed auth internally; we now store hashed passwords ourselves.
-- This migration is safe to run on a fresh backend schema.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS password_hash TEXT;

    -- Index for email lookups (likely already exists from Supabase but ensure it)
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON profiles (email);

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'password_hash') THEN
      COMMENT ON COLUMN profiles.password_hash IS 'bcrypt hash of user password, managed by pact-backend';
    END IF;
  END IF;
END
$$;
