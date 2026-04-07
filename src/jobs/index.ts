import cron from 'node-cron';
import { query } from '../config/database';
import { emailService } from '../services/email.service';
import { sendFcmPush } from '../services/fcm.service';
import { logger } from '../utils/logger';

/** Replaces: supabase/functions/contract-expiry-check */
function scheduleContractExpiryCheck(): void {
  // Runs daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running contract expiry check...');
    try {
      const expiringIn30Days = await query<{
        id: string;
        full_name: string;
        email: string;
        contract_end_date: string;
        fcm_tokens: string[];
      }>(
        `SELECT id, full_name, email, contract_end_date, fcm_tokens
         FROM profiles
         WHERE contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
           AND status = 'active'`
      );

      for (const user of expiringIn30Days) {
        const daysLeft = Math.ceil(
          (new Date(user.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        if (user.email) {
          emailService
            .sendNotification(
              user.email,
              'Contract Expiry Notice',
              `<p>Hello ${user.full_name},</p>
               <p>Your contract expires in <strong>${daysLeft} days</strong> on ${user.contract_end_date}.</p>
               <p>Please contact HR for renewal.</p>`
            )
            .catch((err) => logger.error('Failed to send contract expiry email', { err }));
        }

        if (user.fcm_tokens?.length) {
          sendFcmPush(user.fcm_tokens, {
            title: 'Contract Expiry Notice',
            body: `Your contract expires in ${daysLeft} days.`,
            data: { type: 'contract_expiry', days_left: String(daysLeft) },
          }).catch((err) => logger.error('Failed to send contract expiry push', { err }));
        }
      }

      logger.info(`Contract expiry check complete`, { notified: expiringIn30Days.length });
    } catch (err) {
      logger.error('Contract expiry check failed', { err });
    }
  });
}

/** Replaces: supabase/functions/task-daily-digest */
function scheduleTaskDigest(): void {
  // Runs daily at 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running task daily digest...');
    try {
      const users = await query<{ id: string; email: string; full_name: string; fcm_tokens: string[] }>(
        `SELECT id, email, full_name, fcm_tokens
         FROM profiles
         WHERE status = 'active'
           AND task_digest_opt_out = false`
      );

      for (const user of users) {
        const tasks = await query<{ title: string; priority: string; due_date: string }>(
          `SELECT title, priority, due_date
           FROM project_field_tasks
           WHERE assigned_to = $1
             AND status NOT IN ('completed', 'cancelled')
             AND due_date <= CURRENT_DATE + INTERVAL '7 days'
           ORDER BY due_date ASC
           LIMIT 10`,
          [user.id]
        );

        if (tasks.length === 0) continue;

        if (user.fcm_tokens?.length) {
          sendFcmPush(user.fcm_tokens, {
            title: 'Your Task Digest',
            body: `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due this week.`,
            data: { type: 'task_digest' },
          }).catch((err) => logger.error('Task digest push failed', { err }));
        }
      }

      logger.info('Task digest complete', { usersNotified: users.length });
    } catch (err) {
      logger.error('Task digest failed', { err });
    }
  });
}

export function startJobs(): void {
  scheduleContractExpiryCheck();
  scheduleTaskDigest();
  logger.info('Background jobs started');
}
