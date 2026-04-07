-- Create database tables needed by the independent backend implementation.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  username text,
  full_name text,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'active',
  password_hash text,
  hub_id text,
  state_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz,
  last_seen timestamptz
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON profiles(status);

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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_email_idx ON password_reset_tokens(email);

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_code text NOT NULL UNIQUE,
  description text,
  project_type text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);

CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);
CREATE INDEX IF NOT EXISTS project_members_profile_id_idx ON project_members(profile_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'in-app',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_profile_id_idx ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_chat_id_idx ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_idx ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS chat_messages_receiver_idx ON chat_messages(receiver_id);

CREATE TABLE IF NOT EXISTS down_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  hub_id text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  description text,
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS down_payment_requests_profile_idx ON down_payment_requests(profile_id);
CREATE INDEX IF NOT EXISTS down_payment_requests_project_idx ON down_payment_requests(project_id);
CREATE INDEX IF NOT EXISTS down_payment_requests_status_idx ON down_payment_requests(status);

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

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_account_id uuid NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_account_idx ON wallet_transactions(wallet_account_id);

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

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  request_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawal_requests_wallet_idx ON withdrawal_requests(wallet_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_idx ON withdrawal_requests(user_id);

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

CREATE TABLE IF NOT EXISTS document_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint NOT NULL,
  file_type text,
  category text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS document_index_uploaded_by_idx ON document_index(uploaded_by);

CREATE TABLE IF NOT EXISTS pact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  record_id uuid,
  source_table text,
  payload jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pact_events_source_table_idx ON pact_events(source_table);
CREATE INDEX IF NOT EXISTS pact_events_event_type_idx ON pact_events(event_type);
