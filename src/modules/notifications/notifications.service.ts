import { query, paginate } from '../../config/database';
import { Notification, PaginationParams } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export async function getNotifications(
  userId: string,
  params: PaginationParams & { status?: string }
) {
  const conditions: string[] = ['profile_id = $1'];
  const values: unknown[] = [userId];

  if (params.status === 'unread') {
    conditions.push('is_read = false');
  } else if (params.status === 'read') {
    conditions.push('is_read = true');
  }

  const sql = `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  return paginate<Notification>(sql, values, params.page, params.limit);
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true
     WHERE id = $1 AND profile_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET is_read = true
     WHERE profile_id = $1 AND is_read = false`,
    [userId]
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE profile_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(row.count, 10);
}

export async function createNotification(data: {
  profile_id: string;
  type: string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  channel?: string;
  metadata?: Record<string, unknown>;
}): Promise<Notification> {
  const [notification] = await query<Notification>(
    `INSERT INTO notifications (id, profile_id, type, title, body, payload, is_read, channel, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, NOW())
     RETURNING *`,
    [
      uuidv4(),
      data.profile_id,
      data.type,
      data.title,
      data.body ?? null,
      data.payload ? JSON.stringify(data.payload) : null,
      data.channel ?? 'in-app',
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
  return notification;
}
