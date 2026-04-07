-- Independent backend schema for PACT backend
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles
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

-- Authentication
CREATE TABLE IF NOT EXISTS authentications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS authentications_profile_idx ON authentications(profile_id);

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

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_roles_profile_idx ON user_roles(profile_id);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS permissions_role_idx ON permissions(role_id);

-- Projects
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

CREATE TABLE IF NOT EXISTS project_memberships (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);
CREATE INDEX IF NOT EXISTS project_memberships_profile_id_idx ON project_memberships(profile_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);
CREATE INDEX IF NOT EXISTS project_members_profile_id_idx ON project_members(profile_id);

CREATE TABLE IF NOT EXISTS project_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text,
  description text,
  start_date date,
  end_date date,
  status text,
  is_active boolean NOT NULL DEFAULT true,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_activities_project_idx ON project_activities(project_id);

CREATE TABLE IF NOT EXISTS sub_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES project_activities(id) ON DELETE CASCADE,
  name text,
  description text,
  status text,
  is_active boolean NOT NULL DEFAULT true,
  due_date date,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sub_activities_activity_idx ON sub_activities(activity_id);

CREATE TABLE IF NOT EXISTS project_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_scopes_project_idx ON project_scopes(project_id);

-- Notifications
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

-- Chat
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  type text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_participants_chat_idx ON chat_participants(chat_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_chat_idx ON chat_messages(chat_id);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_message_reads_message_idx ON chat_message_reads(message_id);

-- Documents / storage
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

-- Down payments
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

-- Wallet / payments
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_profile_id_uniq ON wallets(profile_id);

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

CREATE TABLE IF NOT EXISTS wallet_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_settings_profile_idx ON wallet_settings(profile_id);

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

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_methods_profile_idx ON payment_methods(profile_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  wallet_account_id uuid REFERENCES wallet_accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_profile_idx ON payments(profile_id);
CREATE INDEX IF NOT EXISTS payments_wallet_idx ON payments(wallet_account_id);

CREATE TABLE IF NOT EXISTS payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  wallet_account_id uuid REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_requests_wallet_idx ON payout_requests(wallet_account_id);

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

-- Legacy/feature tables restored from old schema
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  audience text,
  start_date timestamptz,
  end_date timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  record_date date NOT NULL,
  status text,
  check_in timestamptz,
  check_out timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_records_employee_idx ON attendance_records(employee_id);

CREATE TABLE IF NOT EXISTS dashboard_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  layout jsonb,
  widget_order text[],
  last_updated timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  layout jsonb,
  widgets jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_visibility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  options jsonb,
  last_updated timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  employee_number text UNIQUE,
  position text,
  department text,
  status text,
  hired_date date,
  manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  user_email text,
  user_name text,
  page_url text,
  page_name text,
  reaction text,
  feedback_text text,
  category text DEFAULT 'general',
  priority text DEFAULT 'medium',
  status text DEFAULT 'new',
  assigned_to uuid REFERENCES profiles(id),
  internal_notes text,
  browser_info jsonb,
  device_info jsonb,
  session_info jsonb,
  ip_address inet,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  latitude double precision,
  longitude double precision,
  reported_by uuid REFERENCES profiles(id),
  status text,
  severity text,
  date_reported timestamptz DEFAULT now(),
  is_synced boolean DEFAULT false,
  last_modified timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  category text,
  quantity integer DEFAULT 0,
  location text,
  status text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid REFERENCES mmp_site_entries(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamptz DEFAULT now(),
  accuracy double precision,
  is_synced boolean DEFAULT false,
  last_modified timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_logs_visit_idx ON location_logs(site_visit_id);

CREATE TABLE IF NOT EXISTS mmp_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  uploaded_at timestamptz,
  uploaded_by text,
  status text,
  entries integer,
  processed_entries integer,
  mmp_id text,
  version jsonb,
  site_entries jsonb,
  workflow jsonb,
  approval_workflow jsonb,
  project_id uuid,
  file_path text,
  original_filename text,
  file_url text,
  description text,
  project_name text,
  type text,
  region text,
  month integer,
  year integer,
  location jsonb,
  team jsonb,
  permits jsonb,
  site_visit jsonb,
  financial jsonb,
  performance jsonb,
  cp_verification jsonb,
  rejection_reason text,
  approved_by text,
  approved_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  archived_by text,
  archived_at timestamptz,
  deleted_by text,
  deleted_at timestamptz,
  expiry_date date,
  modification_history jsonb,
  modified_at timestamptz,
  activities jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mmp_site_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_time timestamptz,
  end_time timestamptz,
  site_data jsonb,
  location jsonb,
  status text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid REFERENCES mmp_site_entries(id),
  notes text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  is_synced boolean DEFAULT false,
  last_modified timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_site_visit_idx ON reports(site_visit_id);

CREATE TABLE IF NOT EXISTS report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id),
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  storage_path text,
  is_synced boolean DEFAULT false,
  last_modified timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE,
  supplier text,
  status text,
  total_amount numeric,
  currency text DEFAULT 'USD',
  items jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb,
  description text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  items jsonb,
  status text,
  requested_at timestamptz DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  status text,
  priority text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  settings jsonb,
  last_updated timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS archive_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Equipment / inventory
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  serial_number text,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Field / site operations
CREATE TABLE IF NOT EXISTS hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location jsonb,
  status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites_registry(id) ON DELETE SET NULL,
  visitor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  visit_date timestamptz,
  report jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_visit_photos_visit_idx ON site_visit_photos(site_visit_id);

CREATE TABLE IF NOT EXISTS site_visit_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_visit_costs_visit_idx ON site_visit_costs(site_visit_id);

CREATE TABLE IF NOT EXISTS site_visit_cost_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id uuid REFERENCES site_visits(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS state_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  permit_number text,
  status text,
  issued_at date,
  expires_at date,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS local_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  permit_number text,
  status text,
  issued_at date,
  expires_at date,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS federal_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  permit_number text,
  status text,
  issued_at date,
  expires_at date,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS visit_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  items jsonb DEFAULT '{}'::jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  device_info jsonb DEFAULT '{}'::jsonb,
  log text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historical_site_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites_registry(id) ON DELETE SET NULL,
  cost numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS cost_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  predicted_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_prediction_id uuid REFERENCES cost_predictions(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS edge_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL,
  limit_count integer NOT NULL DEFAULT 0,
  window_seconds integer NOT NULL DEFAULT 60,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
