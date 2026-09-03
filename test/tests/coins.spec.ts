import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getCoinsResetAt,
  getAchievedDates,
  insertAchievedDay,
  insertPushupSet,
  insertRide,
  populateOAuthClients,
} from '../utils';

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

const isoDate = (daysAgo: number) => {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const insertGoalRide = (daysAgo: number, totalElevationGain: number) =>
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

const counterOf = (page: import('@playwright/test').Page) =>
  page.getByRole('status', { name: /Golden coins/ });

test.describe('Golden coins', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows zero coins when there are no gold days', async ({ page }) => {
    await page.goto('/');

    const counter = counterOf(page);
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAccessibleName(/0 coins, 0 points/);
  });

  test('shows 5 points per gold day', async ({ page }) => {
    await insertAchievedDay(isoDate(3));
    await insertAchievedDay(isoDate(2));
    await insertAchievedDay(isoDate(1));

    await page.goto('/');

    await expect(counterOf(page)).toHaveAccessibleName(/3 coins, 15 points/);
  });

  test('does not count silver or bronze days', async ({ page }) => {
    await insertAchievedDay(isoDate(3), 'GOLD');
    await insertAchievedDay(isoDate(2), 'SILVER');
    await insertAchievedDay(isoDate(1), 'BRONZE');

    await page.goto('/');

    await expect(counterOf(page)).toHaveAccessibleName(/1 coin, 5 points/);
  });

  test('increments coins when today becomes gold', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 95);
    await insertGoalRide(0, 260);

    await page.goto('/');
    const counter = counterOf(page);
    await expect(counter).toHaveAccessibleName(/0 coins, 0 points/);

    const pushups = page.getByRole('region', { name: 'Pushups' });
    await pushups.getByRole('button', { name: 'Add pushups' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add pushups' });
    const dial = dialog.getByRole('slider', { name: 'Pushups' });
    await dial.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
    }
    await dialog.getByRole('button', { name: 'Add 5' }).click();

    await expect(counter).toHaveAccessibleName(/1 coin, 5 points/);
  });

  test('resets coin count from settings without deleting past achieved days', async ({
    page,
  }) => {
    await insertAchievedDay(isoDate(3));
    await insertAchievedDay(isoDate(2));
    await insertAchievedDay(isoDate(1));
    const datesBefore = await getAchievedDates();

    await page.goto('/');
    await expect(counterOf(page)).toHaveAccessibleName(/3 coins, 15 points/);

    await page.goto('/settings');
    const coinsSection = page.getByRole('region', { name: 'Golden coins' });
    await expect(coinsSection.getByText('3 coins')).toBeVisible();

    const before = await getCoinsResetAt();
    await coinsSection.getByRole('button', { name: 'Reset coin count' }).click();
    await expect(page.getByText('Coins reset')).toBeVisible();
    await expect(coinsSection.getByText('0 coins')).toBeVisible();

    const after = await getCoinsResetAt();
    expect(after.getTime()).toBeGreaterThan(before.getTime());
    expect(await getAchievedDates()).toEqual(datesBefore);

    await expect(counterOf(page)).toHaveAccessibleName(/0 coins, 0 points/);
  });

  test('counts coins again for new gold days after reset', async ({ page }) => {
    await insertAchievedDay(isoDate(2));

    await page.goto('/settings');
    const coinsSection = page.getByRole('region', { name: 'Golden coins' });
    await coinsSection.getByRole('button', { name: 'Reset coin count' }).click();
    await expect(page.getByText('Coins reset')).toBeVisible();
    await expect(coinsSection.getByText('0 coins')).toBeVisible();

    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoalRide(0, 260);

    await page.goto('/');
    await expect(counterOf(page)).toHaveAccessibleName(/1 coin, 5 points/);
  });
});
