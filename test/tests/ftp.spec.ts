import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  insertRide,
  insertWeight,
} from '../utils';

test.describe('FTP/kg diff', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows today and period change when FTP/kg has progressed', async ({ page }) => {
    // Past weight establishes the divisor for earlier days; the mock Withings
    // server provides today's weight on sync.
    await insertWeight(1, 80, 20, 16);
    // Yesterday: a 60-minute steady effort at 200W (eFTP = 200W).
    await insertRide(1, 600, 30000, 3600, 'Yesterday', 'Ride', 100, 200, 80);
    // Today: a 60-minute effort at 240W (eFTP = 240W), lifting today's FTP/kg.
    await insertRide(0, 720, 32000, 3600, 'Today', 'Ride', 100, 240, 90);

    await page.goto('/');

    const ftpSection = page.locator('section').filter({ hasText: 'FTP/kg' });
    await expect(ftpSection.getByRole('heading', { name: 'FTP/kg' })).toBeVisible();

    const todayDiff = ftpSection.locator('.today-diff');
    await expect(todayDiff).toHaveText(/↑/);
    await expect(todayDiff).toHaveClass(/green/);

    const periodValue = ftpSection.locator('.period-value');
    await expect(periodValue).toHaveText(/↑/);
  });

  test('renders a placeholder when there is only one FTP measurement', async ({ page }) => {
    // Only a ride today: recompute persists exactly one FTP row.
    await insertRide(0, 720, 32000, 3600, 'Today', 'Ride', 100, 240, 90);

    await page.goto('/');

    const ftpSection = page.locator('section').filter({ hasText: 'FTP/kg' });
    await expect(ftpSection.getByRole('heading', { name: 'FTP/kg' })).toBeVisible();

    await expect(ftpSection.locator('.today-diff')).toHaveCount(0);
    await expect(ftpSection.locator('.period-value')).toHaveText('-');
  });

  test('does not render FTP when rides are too short to estimate', async ({ page }) => {
    // 10-minute ride: under the 20-minute minimum, so no eFTP estimate.
    await insertRide(0, 100, 5000, 600, 'Short', 'Ride', 20, 200, 20);

    await page.goto('/');

    // Wait for the dashboard to load by waiting for another section to appear.
    await expect(page.locator('section').filter({ hasText: 'Fitness' })).toBeVisible();
    await expect(page.locator('section').filter({ hasText: 'FTP/kg' })).toHaveCount(0);
  });
});
