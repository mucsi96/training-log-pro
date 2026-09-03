import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  getAchievedDates,
  getRequirements,
  insertAchievedDay,
  insertPushupSet,
  insertRide,
  setTierRequirements,
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

const tierGroup = (page: Page, tier: 'Gold' | 'Silver' | 'Bronze') =>
  page.getByRole('group', { name: tier });

const requireMetric = async (page: Page, tier: 'Gold' | 'Silver' | 'Bronze', metric: string, goal: number) => {
  const group = tierGroup(page, tier);
  await group.getByRole('checkbox', { name: metric }).check();
  await group.getByLabel(`${metric} goal`).fill(String(goal));
};

test.describe('Settings', () => {
  test('opens settings from the profile menu and shows current requirements', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open profile menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    const gold = tierGroup(page, 'Gold');
    await expect(gold.getByRole('checkbox', { name: 'Pushups' })).toBeChecked();
    await expect(gold.getByLabel('Pushups goal')).toHaveValue('100');
    await expect(gold.getByRole('checkbox', { name: 'Ride elevation' })).toBeChecked();
    await expect(gold.getByLabel('Ride elevation goal')).toHaveValue('250');
    await expect(gold.getByRole('checkbox', { name: 'Reading' })).not.toBeChecked();
    await expect(gold.getByLabel('Reading goal')).toHaveCount(0);
    await expect(gold.getByRole('checkbox', { name: 'Daily tasks' })).not.toBeChecked();
    await expect(gold.getByLabel('Daily tasks goal')).toHaveCount(0);

    for (const tier of ['Silver', 'Bronze'] as const) {
      const group = tierGroup(page, tier);
      await expect(group.getByRole('checkbox')).toHaveCount(4);
      for (const checkbox of await group.getByRole('checkbox').all()) {
        await expect(checkbox).not.toBeChecked();
      }
      await expect(
        group.getByText(`Nothing is required, so a ${tier.toLowerCase()} day is never awarded.`)
      ).toBeVisible();
    }
  });

  test('saves the requirements of every tier separately', async ({ page }) => {
    await page.goto('/settings');

    await tierGroup(page, 'Gold').getByLabel('Pushups goal').fill('80');
    await tierGroup(page, 'Gold').getByLabel('Ride elevation goal').fill('200');
    await requireMetric(page, 'Gold', 'Reading', 20);
    await requireMetric(page, 'Gold', 'Daily tasks', 3);
    await requireMetric(page, 'Silver', 'Pushups', 50);
    await requireMetric(page, 'Bronze', 'Ride elevation', 100);
    await requireMetric(page, 'Bronze', 'Daily tasks', 1);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Settings saved')).toBeVisible();

    expect(await getRequirements()).toEqual({
      GOLD: { PUSHUPS: 80, ELEVATION: 200, READING_PAGES: 20, DAILY_TASKS: 3 },
      SILVER: { PUSHUPS: 50 },
      BRONZE: { ELEVATION: 100, DAILY_TASKS: 1 },
    });

    await page.reload();
    await expect(tierGroup(page, 'Silver').getByLabel('Pushups goal')).toHaveValue('50');
    await expect(tierGroup(page, 'Bronze').getByLabel('Ride elevation goal')).toHaveValue('100');
  });

  test('drops a requirement when its metric is unchecked', async ({ page }) => {
    await page.goto('/settings');

    const gold = tierGroup(page, 'Gold');
    await gold.getByRole('checkbox', { name: 'Ride elevation' }).uncheck();
    await expect(gold.getByLabel('Ride elevation goal')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    expect(await getRequirements()).toEqual({
      GOLD: { PUSHUPS: 100 },
      SILVER: {},
      BRONZE: {},
    });
  });

  test('does not save while a required metric has no goal', async ({ page }) => {
    await page.goto('/settings');

    const silver = tierGroup(page, 'Silver');
    await silver.getByRole('checkbox', { name: 'Pushups' }).check();
    await expect(silver.getByLabel('Pushups goal')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await silver.getByLabel('Pushups goal').fill('0');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await silver.getByLabel('Pushups goal').fill('50');
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('keeps today gold after raising the requirements', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoalRide(0, 260);

    await page.goto('/');
    const dayGoal = page.getByRole('region', { name: 'Day goal' });
    await expect(dayGoal.getByText('Today is a gold day')).toBeVisible();

    expect(await getAchievedDates()).toContain(isoDate(0));

    await page.goto('/settings');
    const gold = tierGroup(page, 'Gold');
    await gold.getByLabel('Pushups goal').fill('200');
    await gold.getByLabel('Ride elevation goal').fill('500');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    await expect(dayGoal.getByText('Today is a gold day')).toBeVisible();
    expect(await getAchievedDates()).toContain(isoDate(0));
  });

  test('preserves previously achieved days when requirements are tightened', async ({ page }) => {
    const dayOfMonth = startOfTodayUtc().getUTCDate();
    const historical = Math.min(2, dayOfMonth - 1);
    const insertedDays: number[] = [];
    for (let d = historical; d >= 1; d--) {
      await insertAchievedDay(isoDate(d));
      insertedDays.push(d);
    }
    if (insertedDays.length === 0) {
      await insertAchievedDay(isoDate(0));
      insertedDays.push(0);
    }
    const expectedCount = String(insertedDays.length);

    await page.goto('/');
    const dayGoal = page.getByRole('region', { name: 'Day goal' });
    const month = dayGoal.getByText('Gold this month').locator('..');
    await expect(month.getByText(expectedCount, { exact: true })).toBeVisible();

    await setTierRequirements('GOLD', { PUSHUPS: 500, ELEVATION: 1000 });

    await page.goto('/');
    await expect(month.getByText(expectedCount, { exact: true })).toBeVisible();
    expect(await getAchievedDates()).toEqual(insertedDays.map((d) => isoDate(d)));
  });

  test('reflects updated requirements on the day goal card when not yet achieved', async ({ page }) => {
    await page.goto('/settings');
    const gold = tierGroup(page, 'Gold');
    await gold.getByLabel('Pushups goal').fill('80');
    await gold.getByLabel('Ride elevation goal').fill('150');
    await requireMetric(page, 'Gold', 'Reading', 20);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    const dayGoal = page.getByRole('region', { name: 'Day goal' });
    await expect(dayGoal.getByText('0/80 pushups')).toBeVisible();
    await expect(dayGoal.getByText('0/150 m')).toBeVisible();
    await expect(dayGoal.getByText('0/20 pages')).toBeVisible();
  });

  test('marks today gold under lower requirements once updated', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 60);
    await insertGoalRide(0, 120);

    await page.goto('/');
    const dayGoal = page.getByRole('region', { name: 'Day goal' });
    await expect(dayGoal.getByText(/^Today is a \w+ day$/)).toBeHidden();

    await setTierRequirements('GOLD', { PUSHUPS: 50, ELEVATION: 100 });

    await page.goto('/');
    await expect(dayGoal.getByText('Today is a gold day')).toBeVisible();
    expect(await getAchievedDates()).toContain(isoDate(0));
  });
});
