import { query, paginate } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { Profile, PaginationParams } from '../../types';

const PUBLIC_FIELDS = `
  id, email, username, full_name, role, avatar_url, hub_id, state_id,
  locality_id, employee_id, phone, status, availability, location,
  location_sharing, created_at, updated_at, bank_account, phone_verified,
  email_verified, last_active_at, department_id, employment_type,
  contract_start_date, contract_end_date, reports_to, fcm_tokens,
  last_seen, device_info, app_version
`;

export async function getProfiles(
  params: PaginationParams & { hub_id?: string; role?: string; status?: string; search?: string }
) {
  const conditions: string[] = ['1=1'];
  const values: unknown[] = [];

  if (params.hub_id) {
    values.push(params.hub_id);
    conditions.push(`hub_id = $${values.length}`);
  }
  if (params.role) {
    values.push(params.role);
    conditions.push(`role = $${values.length}`);
  }
  if (params.status) {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }
  if (params.search) {
    values.push(`%${params.search}%`);
    conditions.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length} OR employee_id ILIKE $${values.length})`);
  }

  const where = conditions.join(' AND ');
  const sql = `SELECT ${PUBLIC_FIELDS} FROM profiles WHERE ${where} ORDER BY created_at DESC`;

  return paginate<Profile>(sql, values, params.page, params.limit);
}

export async function getProfileById(id: string): Promise<Profile> {
  const [profile] = await query<Profile>(
    `SELECT ${PUBLIC_FIELDS} FROM profiles WHERE id = $1`,
    [id]
  );
  if (!profile) throw new AppError('Profile not found', 404);
  return profile;
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
  const allowed = [
    'full_name', 'username', 'phone', 'avatar_url', 'availability',
    'location', 'location_sharing', 'bank_account', 'device_info',
    'app_version', 'fcm_token', 'fcm_tokens',
  ];

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in updates) {
      values.push((updates as Record<string, unknown>)[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) throw new AppError('No valid fields to update', 400);

  values.push(id);
  const [updated] = await query<Profile>(
    `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING ${PUBLIC_FIELDS}`,
    values
  );

  if (!updated) throw new AppError('Profile not found', 404);
  return updated;
}

export async function adminUpdateProfile(
  id: string,
  updates: Partial<Profile>
): Promise<Profile> {
  const allowed = [
    'full_name', 'username', 'phone', 'avatar_url', 'role', 'hub_id',
    'state_id', 'locality_id', 'employee_id', 'status', 'availability',
    'department_id', 'employment_type', 'contract_start_date', 'contract_end_date',
    'reports_to', 'bank_account',
  ];

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in updates) {
      values.push((updates as Record<string, unknown>)[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) throw new AppError('No valid fields to update', 400);

  values.push(id);
  const [updated] = await query<Profile>(
    `UPDATE profiles SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING ${PUBLIC_FIELDS}`,
    values
  );

  if (!updated) throw new AppError('Profile not found', 404);
  return updated;
}

export async function updateFcmToken(userId: string, token: string): Promise<void> {
  await query(
    `UPDATE profiles
     SET fcm_token = $1,
         fcm_tokens = array_append(array_remove(COALESCE(fcm_tokens, ARRAY[]::text[]), $1::text), $1::text),
         fcm_token_updated_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [token, userId]
  );
}

export async function updateLastSeen(userId: string): Promise<void> {
  await query(
    'UPDATE profiles SET last_seen = NOW(), last_active_at = NOW() WHERE id = $1',
    [userId]
  );
}
