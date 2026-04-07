import { Request } from 'express';

/** Authenticated request — populated by auth middleware */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    hub_id?: string;
    state_id?: string;
  };
}

/** Profile row from public.profiles */
export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  hub_id: string | null;
  state_id: string | null;
  locality_id: string | null;
  employee_id: string | null;
  phone: string | null;
  status: string;
  availability: string | null;
  location: Record<string, unknown> | null;
  location_sharing: boolean;
  created_at: string;
  updated_at: string;
  bank_account: Record<string, unknown> | null;
  fcm_token: string | null;
  fcm_tokens: string[];
  phone_verified: boolean;
  email_verified: boolean;
  last_active_at: string;
  department_id: string | null;
  employment_type: string;
  contract_start_date: string | null;
  contract_end_date: string | null;
  reports_to: string | null;
}

/** Wallet row */
export interface Wallet {
  id: string;
  user_id: string;
  currency: string;
  balance_cents: number;
  total_earned_cents: number;
  total_paid_out_cents: number;
  pending_payout_cents: number;
  created_at: string;
  updated_at: string;
}

/** Notification row */
export interface Notification {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  priority: string;
  status: string;
  recipient_id: string;
  recipient_email: string | null;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
}

/** Project row */
export interface Project {
  id: string;
  name: string;
  project_code: string;
  description: string | null;
  project_type: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

/** Pagination query params */
export interface PaginationParams {
  page: number;
  limit: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  return { page, limit };
}
