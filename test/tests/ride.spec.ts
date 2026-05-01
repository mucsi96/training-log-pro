import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, insertRide, pushStravaActivities } from '../utils';

test.describe('Ride', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await pushStravaActivities(2);
    await insertRide(400, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
    await insertRide(355, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
    await insertRide(14, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
    await insertRide(6, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
    await insertRide(5, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
    await insertRide(1, 646, 11747.7, 3074, 'Ride 1', 'MountainBikeRide', 408, 210);
  });

  test('should display today\'s ride stats', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740')).toBeVisible();
    await expect(page.getByText('1 032 m')).toBeVisible();
    await expect(page.getByText('56 km')).toBeVisible();
    await expect(page.getByText('2 h 20 min')).toBeVisible();
  });

  test('should display ride stats for week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('3 678')).toBeVisible();
    await expect(page.getByText('2 256 m')).toBeVisible();
    await expect(page.getByText('91 km')).toBeVisible();
    await expect(page.getByText('4 h 54 min')).toBeVisible();
  });

  test('should display ride stats for month', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Month' }).click();
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('4 324')).toBeVisible();
    await expect(page.getByText('2 664 m')).toBeVisible();
    await expect(page.getByText('103 km')).toBeVisible();
    await expect(page.getByText('5 h 45 min')).toBeVisible();
  });

  test('should display ride stats for year', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Year' }).click();
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('4 970')).toBeVisible();
    await expect(page.getByText('3 072 m')).toBeVisible();
    await expect(page.getByText('115 km')).toBeVisible();
    await expect(page.getByText('6 h 36 min')).toBeVisible();
  });

  test('should display ride stats for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('5 616')).toBeVisible();
    await expect(page.getByText('3 480 m')).toBeVisible();
    await expect(page.getByText('127 km')).toBeVisible();
    await expect(page.getByText('7 h 28 min')).toBeVisible();
  });
});

test.describe('Ride without activity in selected timerange', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await pushStravaActivities(0);
    await insertRide(400, 646, 11747.7, 3074, 'Old Ride', 'MountainBikeRide', 408, 210);
  });

  test('should hide ride stats when no activity in the selected week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Elevation gain' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Distance' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Time' })).toHaveCount(0);
  });

  test('should display ride stats when activity exists for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
  });
});
