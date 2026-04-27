import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  deleteOAuthClient,
  getOAuthClient,
  getFitnessRows,
  insertFitness,
  insertFitnessAt,
} from '../utils';

test.describe('Strava', () => {
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

  test('should pull and persist fitness on first daily sync', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(45.2, 1);
    expect(rows[0].fatigue).toBeCloseTo(52.1, 1);
    expect(rows[0].form).toBeCloseTo(-6.9, 1);
  });

  test('should pull fitness again when last pull was before today', async ({ page }) => {
    await insertFitness(2, 30, 40, -10);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(2);
    expect(rows[1].fitness).toBeCloseTo(45.2, 1);
  });

  test('should skip fitness sync when already pulled today after activities', async ({ page }) => {
    const lateToday = new Date();
    lateToday.setUTCHours(23, 59, 0, 0);
    await insertFitnessAt(lateToday, 30, 40, -10);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fitness).toBeCloseTo(30, 1);
  });

  test('should pull fitness when a new activity arrives after last pull', async ({ page }) => {
    const earlyToday = new Date();
    earlyToday.setUTCHours(0, 1, 0, 0);
    await insertFitnessAt(earlyToday, 30, 40, -10);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740').first()).toBeVisible();

    const rows = await getFitnessRows();
    expect(rows).toHaveLength(2);
    expect(rows[1].fitness).toBeCloseTo(45.2, 1);
  });
});
