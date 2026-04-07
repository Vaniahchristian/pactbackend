import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { env } from './config/env';
import { connectDB } from './config/database';
import { logger } from './utils/logger';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFound } from './middleware/errorHandler';
import { initRealtime } from './modules/realtime/realtime.service';
import { ensureBucketExists } from './modules/storage/storage.service';
import { startJobs } from './jobs';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profiles/profiles.routes';
import projectRoutes from './modules/projects/projects.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import storageRoutes from './modules/storage/storage.routes';

const app = express();
const server = http.createServer(app);

// ── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(compression());
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (_req, res) => res.statusCode < 400 && env.NODE_ENV === 'production',
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(globalLimiter);

// ── Root and health checks ───────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'PACT Backend is running', version: '1.0.0' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── API Routes ────────────────────────────────────────────────────────────────
const v1 = '/api/v1';

app.use(`${v1}/auth`, authRoutes);
app.use(`${v1}/profiles`, profileRoutes);
app.use(`${v1}/projects`, projectRoutes);
app.use(`${v1}/notifications`, notificationRoutes);
app.use(`${v1}/wallet`, walletRoutes);
app.use(`${v1}/storage`, storageRoutes);

// ── 404 & Error handlers ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await connectDB();
    await ensureBucketExists();

    // Real-time (Socket.io + Postgres LISTEN)
    initRealtime(server);

    // Background cron jobs
    startJobs();

    server.listen(env.PORT, () => {
      logger.info(`PACT Backend running`, {
        port: env.PORT,
        env: env.NODE_ENV,
        routes: [
          `${v1}/auth`,
          `${v1}/profiles`,
          `${v1}/projects`,
          `${v1}/notifications`,
          `${v1}/wallet`,
          `${v1}/storage`,
        ],
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { err });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

start();
