import { randomUUID } from 'crypto';
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
  await query('DELETE FROM training_log.segment_effort');
  await query('DELETE FROM training_log.segment');
  await query('DELETE FROM training_log.ride');
  await query('DELETE FROM training_log.fitness');
  await query('DELETE FROM training_log.ftp');
  await query('DELETE FROM training_log.pushup_set');
  await query('DELETE FROM training_log.reading_progress');
  await query('DELETE FROM training_log.book');
  await query('DELETE FROM training_log.daily_task_completion');
  await query('DELETE FROM training_log.daily_task');
  await query('DELETE FROM training_log.oauth2_authorized_client');
  await query('DELETE FROM training_log.golden_day');
  await query('DELETE FROM training_log.week_plan');
  await query('DELETE FROM training_log.activity');
  await query('DELETE FROM training_log.location');
  await query(
    `UPDATE training_log.settings
     SET pushup_goal = $1, elevation_goal = $2, reading_pages_goal = $3,
         daily_task_goal = $4,
         coins_reset_at = TIMESTAMP '1970-01-01 00:00:00',
         work_start_time = NULL, work_end_time = NULL, rain_threshold_mm = NULL
     WHERE id = 1`,
    [100, 250, 0, 0]
  );
}

export async function getSettings() {
  const result = await query(
    `SELECT pushup_goal, elevation_goal, reading_pages_goal, daily_task_goal
     FROM training_log.settings WHERE id = 1`
  );
  return result.rows[0];
}

export async function setGoals(
  pushupGoal: number,
  elevationGoal: number,
  readingPagesGoal: number = 0,
  dailyTaskGoal: number = 0
) {
  await query(
    `UPDATE training_log.settings SET pushup_goal = $1, elevation_goal = $2, reading_pages_goal = $3, daily_task_goal = $4 WHERE id = 1`,
    [pushupGoal, elevationGoal, readingPagesGoal, dailyTaskGoal]
  );
}

export async function getGoldenDayDates(): Promise<string[]> {
  const result = await query(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date FROM training_log.golden_day ORDER BY date ASC`
  );
  return result.rows.map((row) => row.date as string);
}

export async function insertGoldenDay(date: Date | string) {
  await query(
    `INSERT INTO training_log.golden_day (date) VALUES ($1) ON CONFLICT DO NOTHING`,
    [date]
  );
}

export async function getCoinsResetAt(): Promise<Date> {
  const result = await query(
    `SELECT coins_reset_at FROM training_log.settings WHERE id = 1`
  );
  return result.rows[0].coins_reset_at as Date;
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

let rideInsertCounter = 0;

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
  const date = new Date(Date.now() - daysAgo * 86400000 + rideInsertCounter++);
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

export async function insertSegmentEffort(
  effort: {
    id: number;
    segmentId: number;
    segmentName: string;
    segmentDistance: number;
    segmentAverageGrade: number;
    elapsedTime: number;
    daysAgo: number;
    averageWatts?: number | null;
  }
) {
  const startDate = new Date(Date.now() - effort.daysAgo * 86400000);
  await query(
    `INSERT INTO training_log.segment_effort (
      id, segment_id, segment_name, segment_distance, segment_average_grade,
      elapsed_time, average_watts, start_date, ride_created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
    [
      effort.id,
      effort.segmentId,
      effort.segmentName,
      effort.segmentDistance,
      effort.segmentAverageGrade,
      effort.elapsedTime,
      effort.averageWatts ?? null,
      startDate,
    ]
  );
}

export async function getSegmentEffortRows() {
  const result = await query(
    `SELECT id, segment_id, segment_name, segment_distance, segment_average_grade,
            elapsed_time, average_watts, start_date
     FROM training_log.segment_effort ORDER BY id ASC`
  );
  return result.rows;
}

export async function getSegmentRows() {
  const result = await query(
    `SELECT id,
            jsonb_array_length(latitudes)  AS lat_count,
            jsonb_array_length(longitudes) AS lng_count,
            jsonb_array_length(distances)  AS dist_count,
            jsonb_array_length(altitudes)  AS alt_count
     FROM training_log.segment ORDER BY id ASC`
  );
  return result.rows;
}

export async function getFitnessRows() {
  const result = await query(
    'SELECT created_at, pulled_at, fitness, fatigue, form FROM training_log.fitness ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function getFtpRows() {
  const result = await query(
    'SELECT created_at, pulled_at, ftp, weight, ftp_per_kg FROM training_log.ftp ORDER BY created_at ASC'
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

export async function insertBook(
  id: string,
  title: string,
  author: string,
  totalPages: number | null,
  createdAt: Date = new Date(),
  completedAt: Date | null = null,
  startingPage: number = 0
) {
  await query(
    'INSERT INTO training_log.book (id, title, author, total_pages, starting_page, created_at, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, title, author, totalPages, startingPage, createdAt, completedAt]
  );
}

export async function insertReadingProgress(
  bookId: string,
  currentPage: number,
  createdAt: Date
) {
  await query(
    'INSERT INTO training_log.reading_progress (id, created_at, book_id, current_page) VALUES ($1, $2, $3, $4)',
    [randomUUID(), createdAt, bookId, currentPage]
  );
}

export async function getBookRows() {
  const result = await query(
    'SELECT id, title, author, total_pages, starting_page, completed_at FROM training_log.book ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function insertDailyTask(
  id: string,
  name: string,
  createdAt: Date = new Date()
) {
  await query(
    'INSERT INTO training_log.daily_task (id, name, created_at) VALUES ($1, $2, $3)',
    [id, name, createdAt]
  );
}

export async function insertDailyTaskCompletion(
  taskId: string,
  date: Date | string,
  completedAt: Date = new Date()
) {
  await query(
    'INSERT INTO training_log.daily_task_completion (id, task_id, date, completed_at) VALUES ($1, $2, $3, $4)',
    [randomUUID(), taskId, date, completedAt]
  );
}

export async function getDailyTaskRows() {
  const result = await query(
    'SELECT id, name FROM training_log.daily_task ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function getDailyTaskCompletionRows() {
  const result = await query(
    `SELECT id, task_id, to_char(date, 'YYYY-MM-DD') AS date, completed_at
     FROM training_log.daily_task_completion ORDER BY completed_at ASC`
  );
  return result.rows;
}

export async function getReadingProgressRows() {
  const result = await query(
    'SELECT id, created_at, book_id, current_page FROM training_log.reading_progress ORDER BY created_at ASC'
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

export type PushStravaSegmentEffortOptions = {
  id?: number;
  segmentId?: number;
  segmentName?: string;
  segmentDistance?: number;
  segmentAverageGrade?: number;
  elapsedTime?: number;
  averageWatts?: number | null;
};

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
  segmentEfforts?: PushStravaSegmentEffortOptions[];
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

export async function updateStravaActivity(id: number, options: Partial<PushStravaActivityOptions>) {
  const response = await fetch(`http://localhost:8180/strava/test/activities/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    throw new Error(`Failed to update Strava activity: ${response.status}`);
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

export type WithingsMeasure = {
  value: number;
  type: number;
  unit: number;
};

export async function setWithingsMeasures(measures: WithingsMeasure[]) {
  const response = await fetch('http://localhost:8180/withings/test/measure', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ measures }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set Withings measures: ${response.status}`);
  }
}

export async function resetWithingsMeasures() {
  const response = await fetch('http://localhost:8180/withings/test/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset Withings measures: ${response.status}`);
  }
}

export async function getWeightRows() {
  const result = await query(
    'SELECT created_at, weight, fat_ratio, fat_mass_weight FROM training_log.weight ORDER BY created_at ASC'
  );
  return result.rows;
}

export type PlanningSettings = {
  workStartTime?: string;
  workEndTime?: string;
  rainThresholdMm?: number;
};

export async function setPlanningSettings(settings: PlanningSettings) {
  await query(
    `UPDATE training_log.settings SET
       work_start_time = $1, work_end_time = $2, rain_threshold_mm = $3
     WHERE id = 1`,
    [
      settings.workStartTime ?? null,
      settings.workEndTime ?? null,
      settings.rainThresholdMm ?? null,
    ]
  );
}

export type LocationSeed = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  home?: boolean;
  bikeMinutesFromHome?: number;
  carMinutesFromHome?: number;
};

export async function insertLocation(location: LocationSeed): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO training_log.location
       (id, name, address, latitude, longitude, home, bike_minutes_from_home, car_minutes_from_home, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
    [
      id,
      location.name,
      location.address ?? null,
      location.latitude ?? null,
      location.longitude ?? null,
      location.home ?? false,
      location.bikeMinutesFromHome ?? null,
      location.carMinutesFromHome ?? null,
    ]
  );
  return id;
}

export type ActivitySeed = {
  name: string;
  durationMinutes: number;
  occurrencesPerWeek: number;
  locationId?: string;
  earliestTime?: string;
  latestTime?: string;
  daysOfWeek?: string;
  constraintNote?: string;
  priority?: number;
};

export async function insertActivity(activity: ActivitySeed): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO training_log.activity
       (id, name, duration_minutes, occurrences_per_week, location_id, earliest_time,
        latest_time, days_of_week, constraint_note, priority, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
    [
      id,
      activity.name,
      activity.durationMinutes,
      activity.occurrencesPerWeek,
      activity.locationId ?? null,
      activity.earliestTime ?? null,
      activity.latestTime ?? null,
      activity.daysOfWeek ?? null,
      activity.constraintNote ?? null,
      activity.priority ?? null,
    ]
  );
  return id;
}

export async function getActivityRows() {
  const result = await query(
    'SELECT id, name, duration_minutes, occurrences_per_week FROM training_log.activity ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function getLocationRows() {
  const result = await query(
    'SELECT id, name, home FROM training_log.location ORDER BY created_at ASC'
  );
  return result.rows;
}

export async function getWeekPlanRows() {
  const result = await query(
    'SELECT to_char(week_start, \'YYYY-MM-DD\') AS week_start, meetings, days FROM training_log.week_plan ORDER BY week_start ASC'
  );
  return result.rows;
}

export async function setExtractedMeetings(meetings: unknown[]) {
  const response = await fetch('http://localhost:8180/anthropic/test/extraction', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ meetings }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set extracted meetings: ${response.status}`);
  }
}

export async function setSchedulePlan(days: unknown[]) {
  const response = await fetch('http://localhost:8180/anthropic/test/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set schedule plan: ${response.status}`);
  }
}

export async function resetAnthropic() {
  const response = await fetch('http://localhost:8180/anthropic/test/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset Anthropic mock: ${response.status}`);
  }
}

export async function setWeatherForecast(precipitationMm: number) {
  const response = await fetch('http://localhost:8180/weather/test/forecast', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ precipitationMm }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set weather forecast: ${response.status}`);
  }
}

export async function resetWeather() {
  const response = await fetch('http://localhost:8180/weather/test/reset', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reset weather mock: ${response.status}`);
  }
}
