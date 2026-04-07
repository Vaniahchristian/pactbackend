import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!env.smtp.host) {
    logger.warn('SMTP not configured — email not sent', { to, subject });
    return;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  logger.info('Email sent', { to, subject });
}

export const emailService = {
  async sendPasswordReset(email: string, otp: string): Promise<void> {
    await sendMail(
      email,
      'PACT — Password Reset Code',
      `<p>Your password reset code is: <strong>${otp}</strong></p>
       <p>This code expires in 15 minutes.</p>`
    );
  },

  async sendWelcome(email: string, fullName: string): Promise<void> {
    await sendMail(
      email,
      'Welcome to PACT Command Center',
      `<p>Hello ${fullName},</p>
       <p>Your PACT Command Center account has been created. Please log in to get started.</p>`
    );
  },

  async sendNotification(email: string, subject: string, body: string): Promise<void> {
    await sendMail(email, subject, body);
  },

  async sendBulkCostEmail(
    recipients: string[],
    subject: string,
    html: string,
    attachments: { filename: string; content: Buffer; contentType: string }[]
  ): Promise<void> {
    if (!env.smtp.host) {
      logger.warn('SMTP not configured — bulk email not sent');
      return;
    }
    for (const to of recipients) {
      await transporter.sendMail({
        from: env.smtp.from,
        to,
        subject,
        html,
        attachments,
      });
    }
    logger.info('Bulk cost email sent', { count: recipients.length, subject });
  },
};
