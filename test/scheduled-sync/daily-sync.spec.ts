import { expect, test } from '@playwright/test';
import {
  cleanupDb,
  decryptToken,
  getRideRows,
  getStoredOAuthTokens,
  getWeightRows,
  populateOAuthClients,
  pushStravaActivity,
  query,
  resetStravaActivities,
  resetWithingsMeasures,
  updateStravaActivity,
} from '../utils';

test.beforeEach(async () => {
  await cleanupDb();
  await resetStravaActivities();
  await resetWithingsMeasures();
  await pushStravaActivity();
});

test.afterEach(cleanupDb);

test('syncs daily data and refreshes encrypted credentials without opening the app', async () => {
  await populateOAuthClients({ expired: true });

  await expect.poll(async () => (await getWeightRows()).length).toBe(1);
  await expect.poll(async () => (await getRideRows()).length).toBeGreaterThan(0);
  expect(Number((await getWeightRows())[0].weight)).toBe(87.2);

  for (const registration of ['withings-client', 'strava-client']) {
    const stored = await getStoredOAuthTokens(registration);
    expect(stored.accessToken).not.toBe('test-access-token');
    expect(decryptToken(stored.accessToken)).toBe('test-access-token');
    expect(decryptToken(stored.refreshToken)).toBe('test-refresh-token');
    const result = await query(
      'SELECT access_token_expires_at > CURRENT_TIMESTAMP AS refreshed FROM training_log.oauth2_authorized_client WHERE client_registration_id = $1',
      [registration]
    );
    expect(result.rows[0].refreshed).toBe(true);
  }

  await expect.poll(async () => (await query('SELECT * FROM training_log.fitness')).rowCount).toBeGreaterThan(0);
  await expect.poll(async () => (await query('SELECT * FROM training_log.ftp')).rowCount).toBeGreaterThan(0);

  const rides = await getRideRows();
  await updateStravaActivity(1, { sufferScore: 199 });
  await expect.poll(async () => (await getRideRows()).some(ride => ride.suffer_score === 199)).toBe(true);
  expect(await getRideRows()).toHaveLength(rides.length);
  expect(await getWeightRows()).toHaveLength(1);
});

test('still syncs Strava when Withings rejects its credentials', async () => {
  await populateOAuthClients({ withingsAccessToken: 'revoked-access-token' });

  await expect.poll(async () => (await getRideRows()).length).toBeGreaterThan(0);
  expect(await getWeightRows()).toEqual([]);
});
