import { test, expect } from '../fixtures';
import { cleanupDb, insertPushupSet, insertRide, populateOAuthClients } from '../utils';

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const daysAgoAt = (daysAgo: number, hour: number) => {
  const base = startOfTodayUtc();
  base.setUTCDate(base.getUTCDate() - daysAgo);
  base.setUTCHours(hour, 0, 0, 0);
  return base;
};

const insertGoldenRide = (daysAgo: number, totalElevationGain: number) =>
  insertRide(
    daysAgo,
    400,
    20000,
    3600,
    `Ride d-${daysAgo}`,
    'Ride',
    totalElevationGain,
    180
  );

test.describe('Golden day', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows zero state when no golden days', async ({ page }) => {
    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section).toBeVisible();
    await expect(section.getByText('This month')).toBeVisible();
    await expect(section.getByText('Streak')).toBeVisible();
    await expect(section.getByText('0/100 pushups')).toBeVisible();
    await expect(section.getByText('0/250 m')).toBeVisible();
  });

  test('counts golden days for the current month and shows the streak', async ({ page }) => {
    await insertPushupSet(daysAgoAt(2, 8), 100);
    await insertGoldenRide(2, 260);
    await insertPushupSet(daysAgoAt(1, 9), 100);
    await insertGoldenRide(1, 300);
    await insertPushupSet(daysAgoAt(0, 7), 100);
    await insertGoldenRide(0, 250);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('3')).toBeVisible();
    const streak = section.getByText('Streak').locator('..');
    await expect(streak.getByText('3')).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeVisible();
  });

  test('does not count days that meet only one goal', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 200);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('0')).toBeVisible();
    await expect(section.getByText('100 pushups · 200/250 m')).toBeVisible();
  });

  test('triggers confetti when today becomes golden after adding pushups', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 95);
    await insertGoldenRide(0, 260);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('95/100 pushups')).toBeVisible();

    const pushups = page.getByRole('region', { name: 'Pushups' });
    await pushups.getByRole('button', { name: 'Add 10 pushups' }).click();

    await expect(section.getByText('Today is golden')).toBeVisible();
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('1')).toBeVisible();
  });
});
