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
  await query('DELETE FROM training_log.fitness');
  await query('DELETE FROM training_log.pushup_set');
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
      'withings-client', '00000000-0000-0000-0000-000000000001', 'Bearer',
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
      'strava-client', '00000000-0000-0000-0000-000000000001', 'Bearer',
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

export async function getFitnessRows() {
  const result = await query(
    'SELECT created_at, pulled_at, fitness, fatigue, form FROM training_log.fitness ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function insertFitnessAt(
  date: Date,
  pulledAt: Date,
  fitness: number,
  fatigue: number,
  form: number
) {
  await query(
    `INSERT INTO training_log.fitness (created_at, pulled_at, fitness, fatigue, form)
     VALUES ($1, $2, $3, $4, $5)`,
    [date, pulledAt, fitness, fatigue, form]
  );
}

export async function insertPushupSet(date: Date, count: number) {
  await query(
    'INSERT INTO training_log.pushup_set (created_at, count) VALUES ($1, $2)',
    [date, count]
  );
}

export async function getPushupSetRows() {
  const result = await query(
    'SELECT created_at, count FROM training_log.pushup_set ORDER BY created_at ASC'
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

export type PushStravaActivityOptions = {
  totalElevationGain?: number;
  sufferScore?: number | null;
  distance?: number;
  movingTime?: number;
  calories?: number;
  averageWatts?: number;
  weightedAverageWatts?: number;
  name?: string;
  sportType?: string;
};

export async function pushStravaActivity(options: PushStravaActivityOptions = {}) {
  const response = await fetch('http://localhost:8180/strava/test/activities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    throw new Error(`Failed to push Strava activity: ${response.status}`);
  }
}

export async function pushStravaActivities(count: number, options: PushStravaActivityOptions = {}) {
  for (let i = 0; i < count; i++) {
    await pushStravaActivity(options);
  }
}

export async function resetStravaActivities() {
  const response = await fetch('http://localhost:8180/strava/test/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset Strava activities: ${response.status}`);
  }
}
