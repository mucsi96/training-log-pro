import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, deleteOAuthClient, getOAuthClient } from '../utils';

test.describe('Strava', () => {
  test('should authorize strava', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await deleteOAuthClient('strava-client');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock Strava' })).toBeVisible();
    await page.getByRole('link', { name: 'Authorize' }).click();
    await page.waitForURL('**/week');

    const client = await getOAuthClient('strava-client');
    expect(client.principal_name).toBe('rob');
  });

  test('should pull today\'s ride stats from strava', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByText('1 740')).toBeVisible();
    await expect(page.getByText('1 032 m')).toBeVisible();
    await expect(page.getByText('56 km')).toBeVisible();
    await expect(page.getByText('2 h 20 min')).toBeVisible();
  });
});
