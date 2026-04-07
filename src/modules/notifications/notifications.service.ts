import { query, paginate } from '../../config/database';
import { Notification, PaginationParams } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export async function getNotifications(
  userId: string,
  params: PaginationParams & { status?: string }
) {
  const conditions = ['recipient_id = $1'];
  const values: unknown[] = [userId];

  if (params.status) {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }

  const sql = `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  return paginate<Notification>(sql, values, params.page, params.limit);
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await query(
    `UPDATE notifications SET status = 'read', read_at = NOW()
     WHERE id = $1 AND recipient_id = $2`,
    [notificationId, userId]
  );
}

export async function markAllAsRead(userId: string): Promise<void> {
  await query(
    `UPDATE notifications SET status = 'read', read_at = NOW()
     WHERE recipient_id = $1 AND status != 'read'`,
    [userId]
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1 AND status = 'unread'`,
    [userId]
  );
  return parseInt(row.count, 10);
}

export async function createNotification(data: {
  event_type: string;
  entity_type: string;
  entity_id: string;
  recipient_id: string;
  recipient_email?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}): Promise<Notification> {
  const [notification] = await query<Notification>(
    `INSERT INTO notifications (id, event_type, entity_type, entity_id, priority, status, recipient_id, recipient_email, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, 'unread', $6, $7, $8, NOW())
     RETURNING *`,
    [
      uuidv4(),
      data.event_type,
      data.entity_type,
      data.entity_id,
      data.priority ?? 'normal',
      data.recipient_id,
      data.recipient_email ?? null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );
  return notification;
}
