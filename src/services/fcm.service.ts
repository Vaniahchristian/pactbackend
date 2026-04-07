import https from 'https';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface FcmMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Send FCM push to one or more tokens */
export async function sendFcmPush(tokens: string[], message: FcmMessage): Promise<void> {
  if (!env.fcm.serverKey || tokens.length === 0) {
    logger.warn('FCM not configured or no tokens provided');
    return;
  }

  const payload = JSON.stringify({
    registration_ids: tokens,
    notification: { title: message.title, body: message.body },
    data: message.data ?? {},
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'fcm.googleapis.com',
        path: '/fcm/send',
        method: 'POST',
        headers: {
          Authorization: `key=${env.fcm.serverKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) {
          logger.info('FCM push sent', { tokenCount: tokens.length, title: message.title });
          resolve();
        } else {
          reject(new Error(`FCM responded with status ${res.statusCode}`));
        }
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
