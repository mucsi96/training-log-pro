import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5480,
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
  await query('DELETE FROM training_log.weight');
  await query('DELETE FROM training_log.ride');
  await query('DELETE FROM training_log.oauth2_authorized_client');
}

export async function populateOAuthClients() {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86400000).toISOString();

  await query(
    `INSERT INTO training_log.oauth2_authorized_client (
      client_registration_id, principal_name, access_token_type,
      access_token_value, access_token_issued_at, access_token_expires_at,
      access_token_scopes, refresh_token_value, refresh_token_issued_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      'withings-client', 'test-user', 'Bearer',
      Buffer.from('test-access-token'), now, tomorrow,
      'user.metrics', Buffer.from('test-refresh-token'), now, now,
    ]
  );

  await query(
    `INSERT INTO training_log.oauth2_authorized_client (
      client_registration_id, principal_name, access_token_type,
      access_token_value, access_token_issued_at, access_token_expires_at,
      access_token_scopes, refresh_token_value, refresh_token_issued_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      'strava-client', 'test-user', 'Bearer',
      Buffer.from('test-access-token'), now, tomorrow,
      'activity:read', Buffer.from('test-refresh-token'), now, now,
    ]
  );
}

export async function insertWeight(
  daysAgo: number,
  weight: number,
  fatRatio: number,
  fatMassWeight: number
) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  await query(
    'INSERT INTO training_log.weight (created_at, weight, fat_ratio, fat_mass_weight) VALUES ($1, $2, $3, $4)',
    [date, weight, fatRatio, fatMassWeight]
  );
}

export async function insertRide(
  daysAgo: number,
  calories: number,
  distance: number,
  movingTime: number,
  name: string,
  sportType: string,
  totalElevationGain: number,
  weightedAverageWatts: number,
  sufferScore: number | null = null
) {
  const date = new Date(Date.now() - daysAgo * 86400000);
  await query(
    `INSERT INTO training_log.ride (
      created_at, calories, distance, moving_time, name,
      sport_type, total_elevation_gain, weighted_average_watts, suffer_score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [date, calories, distance, movingTime, name, sportType, totalElevationGain, weightedAverageWatts, sufferScore]
  );
}

export async function getRideRows() {
  const result = await query(
    'SELECT created_at, suffer_score FROM training_log.ride ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function deleteOAuthClient(clientRegistrationId: string) {
  await query(
    'DELETE FROM training_log.oauth2_authorized_client WHERE client_registration_id = $1',
    [clientRegistrationId]
  );
}

export async function getOAuthClient(clientRegistrationId: string) {
  const result = await query(
    'SELECT principal_name FROM training_log.oauth2_authorized_client WHERE client_registration_id = $1',
    [clientRegistrationId]
  );
  return result.rows[0];
}
