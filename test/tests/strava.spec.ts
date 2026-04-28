import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  deleteOAuthClient,
  getOAuthClient,
  getRideRows,
  getFitnessRows,
  insertFitnessAt,
  pushStravaActivities,
} from '../utils';

test.describe('Strava', () => {
  test.beforeEach(async () => {
    await pushStravaActivities(2);
  });

  test('should authorize strava', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await deleteOAuthClient('strava-client');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock Strava' })).toBeVisible();
    await page.getByRole('link', { name: 'Authorize' }).click();
    await page.waitForURL('/');

    const client = await getOAuthClient('strava-client');
    expect(client.principal_name).toBe('test-user');
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

  test('should show last activity pull timestamp', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('fitness-last-pull')).toContainText(/Last activity pull/);
  });

  test('should skip recompute when already pulled today after activities', async ({ page }) => {
    // Pre-seed fitness as if it was pulled at 23:59 today, so the sync sees no
    // newer activities and skips the recompute. The seeded values must remain.
    const lateToday = new Date();
    lateToday.setUTCHours(23, 59, 0, 0);
    await insertFitnessAt(lateToday, lateToday, 30, 40, -10);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(30, 1);
    expect(rows[0].fatigue).toBeCloseTo(40, 1);
    expect(rows[0].form).toBeCloseTo(-10, 1);
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
