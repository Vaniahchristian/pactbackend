/**
 * Simple migration runner.
 * Files in src/db/migrations/ are run in alphabetical order.
 * Tracks applied migrations in a `_migrations` table.
 *
 * Usage:
 *   npm run migrate          — apply pending migrations
 *   npm run migrate:down     — (not yet implemented, migrations are write-forward)
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'pact_db',
  user: process.env.DB_USER ?? 'pact_user',
  password: process.env.DB_PASSWORD ?? '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Create src/db/migrations/ and add .sql files.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows: applied } = await client.query('SELECT filename FROM _migrations');
    const appliedSet = new Set(applied.map((r: { filename: string }) => r.filename));

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  ✓ ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  → Applying ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ ${file} applied`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${file} FAILED:`, err);
        process.exit(1);
      }
    }

    console.log(`\nMigrations complete. ${count} applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
