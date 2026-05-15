import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, insertRide } from '../utils';

test.describe('Fitness diff', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows today and period change when fitness has progressed', async ({ page }) => {
    // Ride 7 days ago + today produces a higher fitness today than yesterday
    // (yesterday decays without a ride) and a larger gain over the whole period.
    await insertRide(7, 1740, 56000, 8400, 'Week ago', 'Ride', 1032, 200, 244);
    await insertRide(0, 1740, 56000, 8400, 'Today', 'Ride', 1032, 200, 244);

    await page.goto('/');

    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const todayDiff = fitnessSection.locator('.today-diff');
    await expect(todayDiff).toHaveText(/↑/);
    await expect(todayDiff).toHaveClass(/green/);

    const periodValue = fitnessSection.locator('.period-value');
    await expect(periodValue).toHaveText(/↑/);
  });

  test('shows a downward today diff when fitness decays without a ride', async ({ page }) => {
    // Ride 2 days ago, no rides since. Yesterday and today both decay,
    // so today's fitness is lower than yesterday's.
    await insertRide(2, 1740, 56000, 8400, 'Two days ago', 'Ride', 1032, 200, 244);

    await page.goto('/');

    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const todayDiff = fitnessSection.locator('.today-diff');
    await expect(todayDiff).toHaveText(/↓/);
    await expect(todayDiff).toHaveClass(/red/);
  });

  test('shows period diff over the selected month timeframe', async ({ page }) => {
    // Ride 25 days ago, ride today: period diff for month covers both samples.
    await insertRide(25, 1740, 56000, 8400, 'Month ago', 'Ride', 1032, 200, 244);
    await insertRide(0, 1740, 56000, 8400, 'Today', 'Ride', 1032, 200, 244);

    await page.goto('/');
    await page.getByRole('link', { name: 'Month' }).click();

    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    const periodValue = fitnessSection.locator('.period-value');
    await expect(periodValue).toHaveText(/↑/);
  });

  test('renders a placeholder when there is only one fitness measurement', async ({ page }) => {
    // A ride only today: recompute persists exactly one fitness row.
    await insertRide(0, 1740, 56000, 8400, 'Today', 'Ride', 1032, 200, 244);

    await page.goto('/');

    const fitnessSection = page.locator('section').filter({ hasText: 'Fitness' });
    await expect(fitnessSection.getByRole('heading', { name: 'Fitness' })).toBeVisible();

    await expect(fitnessSection.locator('.today-diff')).toHaveCount(0);
    await expect(fitnessSection.locator('.period-value')).toHaveText('-');
  });
});
