import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  deleteOAuthClient,
  getOAuthClient,
  getRideRows,
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

  test('should compute fitness, fatigue, and form from synced activities', async ({ page }) => {
    // Synced activities contribute today's load = 82 + 162 = 244 (suffer_score)
    // CTL: fitness ≈ (1 - exp(-1/42)) * 244 ≈ 5.7
    // ATL: fatigue ≈ (1 - exp(-1/7)) * 244 ≈ 32.5
    // form = fitness - fatigue ≈ -27
    await page.goto('/');
    const fitnessSection = page.locator('section').filter({ hasText: 'Fatigue' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();
    await expect(fitnessSection.getByRole('heading', { name: 'Fatigue' })).toBeVisible();
    await expect(fitnessSection.getByRole('heading', { name: 'Form' })).toBeVisible();
    await expect(fitnessSection.getByText('6', { exact: true })).toBeVisible();
    await expect(fitnessSection.getByText('32', { exact: true })).toBeVisible();
    await expect(fitnessSection.getByText('-27', { exact: true })).toBeVisible();
  });
});
