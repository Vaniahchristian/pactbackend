-- Add core support tables for auth refresh tokens, project membership, storage metadata, and wallet top-ups

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  user_agent text,
  ip_address text,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS refresh_tokens_profile_id_idx ON refresh_tokens(profile_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS project_members_profile_id_idx ON project_members(profile_id);

CREATE TABLE IF NOT EXISTS storage_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  privacy text NOT NULL DEFAULT 'private',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id uuid NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text,
  mime_type text,
  size bigint NOT NULL DEFAULT 0,
  url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_objects_bucket_key_uniq ON storage_objects(bucket_id, key);
CREATE INDEX IF NOT EXISTS storage_objects_uploaded_by_idx ON storage_objects(uploaded_by);

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_accounts_profile_id_uniq ON wallet_accounts(profile_id);

CREATE TABLE IF NOT EXISTS wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_account_id uuid NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  source text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_topups_account_idx ON wallet_topups(wallet_account_id);
