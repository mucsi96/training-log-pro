import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  deleteOAuthClient,
  getOAuthClient,
  getStoredOAuthTokens,
  decryptToken,
  getRideRows,
  getFitnessRows,
  insertFitnessAt,
  insertRide,
  pushStravaActivities,
  pushStravaActivity,
  updateStravaActivity,
} from '../utils';

test.describe('Strava', () => {
  test.beforeEach(async () => {
    await pushStravaActivities(2);
  });

  test('should authorize strava and store tokens encrypted at rest', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await deleteOAuthClient('strava-client');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock Strava' })).toBeVisible();
    await page.getByRole('link', { name: 'Authorize' }).click();
    await page.waitForURL('/');

    const client = await getOAuthClient('strava-client');
    expect(client.principal_name).toBe('00000000-0000-0000-0000-000000000001');

    const stored = await getStoredOAuthTokens('strava-client');
    // The raw column must not contain the plaintext token...
    expect(stored.accessToken).not.toBe('test-access-token');
    expect(stored.refreshToken).not.toBe('test-refresh-token');
    // ...but it must still be the real token, recoverable via decryption.
    expect(decryptToken(stored.accessToken)).toBe('test-access-token');
    expect(decryptToken(stored.refreshToken)).toBe('test-refresh-token');
  });

  test('should pull today\'s ride stats from strava', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();
    await expect(page.getByText('1 032 m').first()).toBeVisible();
    await expect(page.getByText('56 km').first()).toBeVisible();
    await expect(page.getByText('2 h 20 min').first()).toBeVisible();
  });

  test('should persist suffer_score from synced activities', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getRideRows();
    expect(rows).toHaveLength(2);
    const sufferScores = rows.map(row => row.suffer_score).sort((a, b) => a - b);
    expect(sufferScores[0]).toBeCloseTo(82, 0);
    expect(sufferScores[1]).toBeCloseTo(162, 0);
  });

  test('should persist computed fitness, fatigue, form on first sync', async ({ page }) => {
    // Daily load = suffer_score 82 + 162 = 244
    // fitness = (1 - exp(-1/42)) * 244 ≈ 5.747
    // fatigue = (1 - exp(-1/7)) * 244 ≈ 32.483
    // form = fitness - fatigue ≈ -26.736
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(5.747, 1);
    expect(rows[0].fatigue).toBeCloseTo(32.483, 1);
    expect(rows[0].form).toBeCloseTo(-26.736, 1);
    expect(rows[0].pulled_at).not.toBeNull();
  });

  test('should display fitness value and a chart', async ({ page }) => {
    await page.goto('/');
    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();
    await expect(fitnessSection.getByRole('heading', { name: 'Fatigue' })).toHaveCount(0);
    await expect(fitnessSection.getByRole('heading', { name: 'Form' })).toHaveCount(0);
    await expect(fitnessSection.getByText('6', { exact: true })).toBeVisible();
    const chart = fitnessSection.locator('[role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /Line chart.*Fitness/);
  });

  test('does not rewrite fitness rows when re-syncing produces the same values', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const firstRows = await getFitnessRows();
    expect(firstRows).toHaveLength(1);
    const firstPulledAt = firstRows[0].pulled_at as Date;
    expect(firstPulledAt).not.toBeNull();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const secondRows = await getFitnessRows();
    expect(secondRows).toHaveLength(1);
    expect(secondRows[0].fitness).toBeCloseTo(firstRows[0].fitness, 5);
    expect((secondRows[0].pulled_at as Date).getTime()).toBe(firstPulledAt.getTime());
  });

  test('should recompute fitness when last pull was before today', async ({ page }) => {
    const yesterday = new Date(Date.now() - 86400000);
    await insertFitnessAt(yesterday, yesterday, 30, 40, -10);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(5.747, 1);
  });
});

test.describe('Fitness when Strava back-fills suffer_score', () => {
  test('recomputes fitness after a previously null suffer_score becomes available', async ({ page }) => {
    // First sync: Strava has the ride but has not yet computed suffer_score.
    await pushStravaActivity({ sufferScore: null });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const initialRideRows = await getRideRows();
    expect(initialRideRows).toHaveLength(1);
    expect(initialRideRows[0].suffer_score).toBeNull();

    const initialFitnessRows = await getFitnessRows();
    expect(initialFitnessRows).toHaveLength(1);
    expect(initialFitnessRows[0].fitness).toBeCloseTo(0, 3);

    // Strava finishes processing the activity and exposes a suffer_score for
    // the same ride. Reloading the page must re-sync and recompute fitness,
    // even though the ride's start time is before the previous pull.
    await updateStravaActivity(1, { sufferScore: 100 });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    await expect.poll(async () => (await getRideRows())[0]?.suffer_score).toBeCloseTo(100, 0);

    const updatedFitnessRows = await getFitnessRows();
    expect(updatedFitnessRows).toHaveLength(1);
    // fitness = (1 - exp(-1/42)) * 100 ≈ 2.355
    expect(updatedFitnessRows[0].fitness).toBeCloseTo(2.355, 1);
  });
});

test.describe('Strava ride without power data', () => {
  test('syncs a ride whose weighted_average_watts is null without crashing', async ({ page }) => {
    // A ride recorded without a power meter has no weighted average watts.
    await pushStravaActivity({ weightedAverageWatts: null });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();

    const rows = await getRideRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].weighted_average_watts).toBeNull();
  });
});

test.describe('Fitness without a ride today', () => {
  test('decays yesterday fitness into today even before any activity', async ({ page }) => {
    // Yesterday: rides synced and fitness computed at the end of the day.
    // No Strava activities are pushed for today.
    const yesterday = new Date(Date.now() - 86400000);
    await insertRide(1, 1740, 56000, 8400, 'Yesterday Ride 1', 'Ride', 1032, 200, 82);
    await insertRide(1, 1740, 56000, 8400, 'Yesterday Ride 2', 'Ride', 1032, 200, 162);
    await insertFitnessAt(yesterday, yesterday, 5.747, 32.483, -26.736);

    await page.goto('/');

    // The fitness diagram is visible with today's decayed value.
    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();
    const chart = fitnessSection.locator('[role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /Line chart.*Fitness/);

    // Today's fitness ≈ LAMBDA_FITNESS * yesterday = exp(-1/42) * 5.747 ≈ 5.612
    const rows = await getFitnessRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].fitness).toBeCloseTo(5.747, 1);
    expect(rows[1].fitness).toBeCloseTo(5.612, 1);
    expect(rows[1].fitness).toBeLessThan(rows[0].fitness);
  });

  test('persists a zero fitness row for today when there are no rides at all', async ({ page }) => {
    // Brand-new state: no rides have been recorded, no fitness rows exist.
    // The first sync of the day must still produce today's row so the UI can
    // render the section.
    await page.goto('/');

    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();
    const chart = fitnessSection.locator('[role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /Line chart.*Fitness/);
    await expect(fitnessSection.getByText('0', { exact: true })).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(0, 3);
    expect(rows[0].fatigue).toBeCloseTo(0, 3);
    expect(rows[0].form).toBeCloseTo(0, 3);
  });
});
