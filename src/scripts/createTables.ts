import fs from 'fs';
import path from 'path';
import { query } from '../config/database';

async function main() {
  const sqlPath = path.resolve(__dirname, '../../sql/schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await query(sql);
  console.log('Database schema created successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});