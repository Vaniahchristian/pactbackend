import { Pool, PoolClient } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  min: env.db.poolMin,
  max: env.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

export async function connectDB(): Promise<void> {
  const client = await pool.connect();
  client.release();
  logger.info('PostgreSQL connected', {
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
  });
}

/** Run a single query with auto-released client */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn('Slow query detected', { text: text.slice(0, 100), duration });
  }
  return res.rows as T[];
}

/** Run multiple queries in a single transaction */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Paginated query helper */
export async function paginate<T = Record<string, unknown>>(
  text: string,
  params: unknown[],
  page: number,
  limit: number
): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
  const offset = (page - 1) * limit;

  const countQuery = `SELECT COUNT(*) as total FROM (${text}) as sub`;
  const dataQuery = `${text} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, limit, offset]),
  ]);

  const total = parseInt(countResult.rows[0].total, 10);
  return {
    data: dataResult.rows as T[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
