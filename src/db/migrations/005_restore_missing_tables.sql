-- Restore missing backend tables from the legacy schema

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
