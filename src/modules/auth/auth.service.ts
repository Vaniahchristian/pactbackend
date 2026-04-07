import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../config/database';
import { generateTokens, verifyRefreshToken } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { Profile } from '../../types';
import { logger } from '../../utils/logger';

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: string;
  hub_id?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface UserWithPassword extends Profile {
  password_hash: string | null;
}

export async function register(input: RegisterInput) {
  const { email, password, full_name, phone, role = 'user', hub_id } = input;

  const existing = await query<{ id: string }>(
    'SELECT id FROM profiles WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.length > 0) {
    throw new AppError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();

  const [profile] = await query<Profile>(
    `INSERT INTO profiles (id, email, full_name, phone, role, hub_id, status, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW())
     RETURNING id, email, full_name, role, hub_id, status, created_at`,
    [id, email.toLowerCase(), full_name, phone ?? null, role, hub_id ?? null, passwordHash]
  );

  // Create wallet for new user
  await query(
    `INSERT INTO wallets (id, user_id, currency, balance_cents, total_earned_cents, total_paid_out_cents, pending_payout_cents, created_at, updated_at)
     VALUES ($1, $2, 'USD', 0, 0, 0, 0, NOW(), NOW())`,
    [uuidv4(), id]
  );

  logger.info('New user registered', { id, email });

  const tokens = generateTokens({
    sub: profile.id,
    email: profile.email!,
    role: profile.role!,
    hub_id: profile.hub_id ?? undefined,
  });

  return { profile, ...tokens };
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  const [user] = await query<UserWithPassword>(
    `SELECT id, email, full_name, role, hub_id, state_id, status, password_hash, avatar_url
     FROM profiles WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.password_hash) {
    throw new AppError('Account requires password reset. Please use the reset flow.', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.status === 'suspended') {
    throw new AppError('Account suspended. Contact your administrator.', 403);
  }

  // Update last_active_at
  await query('UPDATE profiles SET last_active_at = NOW(), last_seen = NOW() WHERE id = $1', [user.id]);

  const tokens = generateTokens({
    sub: user.id,
    email: user.email!,
    role: user.role!,
    hub_id: user.hub_id ?? undefined,
    state_id: user.state_id ?? undefined,
  });

  const { password_hash: _, ...profile } = user;
  return { profile, ...tokens };
}

export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (payload.type !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }

  const [user] = await query<Pick<Profile, 'id' | 'email' | 'role' | 'hub_id' | 'state_id' | 'status'>>(
    'SELECT id, email, role, hub_id, state_id, status FROM profiles WHERE id = $1',
    [payload.sub]
  );

  if (!user || user.status === 'suspended') {
    throw new AppError('Account not found or suspended', 401);
  }

  const tokens = generateTokens({
    sub: user.id,
    email: user.email!,
    role: user.role!,
    hub_id: user.hub_id ?? undefined,
    state_id: user.state_id ?? undefined,
  });

  return tokens;
}

export async function requestPasswordReset(email: string) {
  const [user] = await query<{ id: string }>(
    'SELECT id FROM profiles WHERE email = $1',
    [email.toLowerCase()]
  );

  // Always respond success (don't reveal if email exists)
  if (!user) return;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await query(
    `INSERT INTO password_reset_tokens (id, email, otp, expires_at, used, created_at)
     VALUES ($1, $2, $3, $4, false, NOW())`,
    [uuidv4(), email.toLowerCase(), otp, expiresAt]
  );

  logger.info('Password reset OTP generated', { email });
  return otp; // caller is responsible for sending via email
}

export async function resetPasswordWithOtp(email: string, otp: string, newPassword: string) {
  const [token] = await query<{ id: string; expires_at: string; used: boolean }>(
    `SELECT id, expires_at, used FROM password_reset_tokens
     WHERE email = $1 AND otp = $2
     ORDER BY created_at DESC LIMIT 1`,
    [email.toLowerCase(), otp]
  );

  if (!token || token.used) {
    throw new AppError('Invalid or already used OTP', 400);
  }

  if (new Date(token.expires_at) < new Date()) {
    throw new AppError('OTP has expired', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await transaction(async (client) => {
    await client.query(
      'UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [passwordHash, email.toLowerCase()]
    );
    await client.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [token.id]
    );
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [user] = await query<{ password_hash: string | null }>(
    'SELECT password_hash FROM profiles WHERE id = $1',
    [userId]
  );

  if (!user?.password_hash) {
    throw new AppError('No password set on this account', 400);
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw new AppError('Current password is incorrect', 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $1',
    [passwordHash, userId]
  );
}
