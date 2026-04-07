import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000'), 10),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: parseInt(optional('DB_PORT', '5432'), 10),
    name: optional('DB_NAME', 'pact_db'),
    user: optional('DB_USER', 'pact_user'),
    password: optional('DB_PASSWORD', ''),
    ssl: optional('DB_SSL', 'false') === 'true',
    poolMin: parseInt(optional('DB_POOL_MIN', '2'), 10),
    poolMax: parseInt(optional('DB_POOL_MAX', '20'), 10),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'dev_secret_change_in_production'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_in_production'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173').split(','),
  },

  minio: {
    endpoint: optional('MINIO_ENDPOINT', 'localhost'),
    port: parseInt(optional('MINIO_PORT', '9000'), 10),
    useSsl: optional('MINIO_USE_SSL', 'false') === 'true',
    accessKey: optional('MINIO_ACCESS_KEY', ''),
    secretKey: optional('MINIO_SECRET_KEY', ''),
    bucket: optional('MINIO_BUCKET', 'pact-files'),
  },

  smtp: {
    host: optional('SMTP_HOST', ''),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    secure: optional('SMTP_SECURE', 'false') === 'true',
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'PACT <noreply@example.com>'),
  },

  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    password: optional('REDIS_PASSWORD', ''),
  },

  fcm: {
    serverKey: optional('FCM_SERVER_KEY', ''),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
  },
};
