import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5460,
  database: 'test',
  user: 'postgres',
  password: 'postgres',
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function cleanupDb() {
  await query('DELETE FROM weight');
  await query('DELETE FROM ride');
  await query('DELETE FROM fitness');
}

export async function populateDb() {
  await query(`
    INSERT INTO weight (created_at, weight, fat_ratio, fat_mass_weight)
    VALUES (NOW(), 80.5, 15.2, 12.3)
    ON CONFLICT DO NOTHING
  `);
}
