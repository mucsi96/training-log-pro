import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  DayGoalTier,
  getAchievedDays,
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

const addPushupsThroughDialog = async (page: Page, count: number) => {
  const pushups = page.getByRole('region', { name: 'Pushups' });
  await pushups.getByRole('button', { name: 'Add pushups' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add pushups' });
  const dial = dialog.getByRole('slider', { name: 'Pushups' });
  await dial.focus();
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('ArrowUp');
  }
  await dialog.getByRole('button', { name: `Add ${count}` }).click();
};

const dayGoal = (page: Page) => page.getByRole('region', { name: 'Day goal' });
const monthCount = (page: Page, tier: 'Gold' | 'Silver' | 'Bronze') =>
  dayGoal(page).getByText(`${tier} this month`).locator('..');
const streak = (page: Page) => dayGoal(page).getByText('Streak').locator('..');
const achievedStatus = (page: Page) => dayGoal(page).getByText(/^Today is a \w+ day$/);

test.describe('Day goal', () => {
  test('shows zero state when no day has been achieved', async ({ page }) => {
    await page.goto('/');

    const section = dayGoal(page);
    await expect(section).toBeVisible();
    for (const tier of ['Gold', 'Silver', 'Bronze'] as const) {
      await expect(monthCount(page, tier).getByText('0', { exact: true })).toBeVisible();
    }
    await expect(streak(page).getByText('0', { exact: true })).toBeVisible();
    await expect(section.getByText('Next: gold')).toBeVisible();
    await expect(section.getByText('0/100 pushups')).toBeVisible();
    await expect(section.getByText('0/250 m')).toBeVisible();
    await expect(achievedStatus(page)).toBeHidden();
  });

  test('counts gold days for the current month and shows the streak', async ({ page }) => {
    const dayOfMonth = startOfTodayUtc().getUTCDate();
    const total = Math.min(3, dayOfMonth);

    for (let d = total - 1; d >= 0; d--) {
      await insertPushupSet(daysAgoAt(d, 7 + d), 100);
      await insertGoalRide(d, 250 + d * 25);
    }

    await page.goto('/');

    await expect(monthCount(page, 'Gold').getByText(String(total), { exact: true })).toBeVisible();
    await expect(streak(page).getByText(String(total), { exact: true })).toBeVisible();
    await expect(dayGoal(page).getByText('Today is a gold day')).toBeVisible();
    await expect(dayGoal(page).getByText(/^Next:/)).toBeHidden();
  });

  test('does not award a tier while one of its requirements is missing', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);

    await page.goto('/');

    const section = dayGoal(page);
    await expect(section.getByText('Next: gold')).toBeVisible();
    await expect(section.getByText('100/100 pushups')).toBeVisible();
    await expect(section.getByText('0/250 m')).toBeVisible();
    await expect(achievedStatus(page)).toBeHidden();
    await expect(monthCount(page, 'Gold').getByText('0', { exact: true })).toBeVisible();
    expect(await getAchievedDays()).toEqual([]);
  });

  test('lights up when today becomes gold after adding pushups', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 95);
    await insertGoalRide(0, 260);

    await page.goto('/');

    const section = dayGoal(page);
    await expect(section.getByText('95/100 pushups')).toBeVisible();
    await expect(achievedStatus(page)).toBeHidden();

    await addPushupsThroughDialog(page, 5);

    await expect(section.getByText('Today is a gold day')).toBeVisible();
    await expect(monthCount(page, 'Gold').getByText('1', { exact: true })).toBeVisible();
    expect(await getAchievedDays()).toEqual([{ date: isoDate(0), tier: 'GOLD' }]);
  });

  test('awards the most demanding tier whose requirements are all met', async ({ page }) => {
    await setTierRequirements('SILVER', { PUSHUPS: 50 });
    await setTierRequirements('BRONZE', { ELEVATION: 100 });
    await insertPushupSet(daysAgoAt(0, 8), 60);

    await page.goto('/');

    const section = dayGoal(page);
    await expect(section.getByText('Today is a silver day')).toBeVisible();
    await expect(section.getByText('Next: gold')).toBeVisible();
    await expect(section.getByText('60/100 pushups')).toBeVisible();
    await expect(section.getByText('0/250 m')).toBeVisible();
    await expect(monthCount(page, 'Silver').getByText('1', { exact: true })).toBeVisible();
    await expect(monthCount(page, 'Bronze').getByText('0', { exact: true })).toBeVisible();
    expect(await getAchievedDays()).toEqual([{ date: isoDate(0), tier: 'SILVER' }]);
  });

  test('shows progress towards the least demanding attainable tier', async ({ page }) => {
    await setTierRequirements('SILVER', { PUSHUPS: 50, READING_PAGES: 10 });
    await setTierRequirements('BRONZE', { PUSHUPS: 20 });
    await insertPushupSet(daysAgoAt(0, 8), 5);

    await page.goto('/');

    const section = dayGoal(page);
    await expect(section.getByText('Next: bronze')).toBeVisible();
    await expect(section.getByText('5/20 pushups')).toBeVisible();
    await expect(section.getByText(/pages$/)).toBeHidden();
    await expect(section.getByText(/ m$/)).toBeHidden();

    await addPushupsThroughDialog(page, 15);

    await expect(section.getByText('Today is a bronze day')).toBeVisible();
    await expect(section.getByText('Next: silver')).toBeVisible();
    await expect(section.getByText('20/50 pushups')).toBeVisible();
    await expect(section.getByText('0/10 pages')).toBeVisible();
  });

  test('upgrades today when a higher tier is reached and never downgrades it', async ({ page }) => {
    await setTierRequirements('SILVER', { PUSHUPS: 50 });
    await insertPushupSet(daysAgoAt(0, 8), 60);

    await page.goto('/');
    await expect(dayGoal(page).getByText('Today is a silver day')).toBeVisible();

    await insertPushupSet(daysAgoAt(0, 9), 40);
    await insertGoalRide(0, 260);

    await page.goto('/');
    await expect(dayGoal(page).getByText('Today is a gold day')).toBeVisible();
    expect(await getAchievedDays()).toEqual([{ date: isoDate(0), tier: 'GOLD' }]);

    await setTierRequirements('GOLD', { PUSHUPS: 500, ELEVATION: 250 });

    await page.goto('/');
    await expect(dayGoal(page).getByText('Today is a gold day')).toBeVisible();
    expect(await getAchievedDays()).toEqual([{ date: isoDate(0), tier: 'GOLD' }]);
  });

  test('never awards a tier that requires nothing', async ({ page }) => {
    await setTierRequirements('GOLD', {});
    await setTierRequirements('SILVER', {});
    await setTierRequirements('BRONZE', {});
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoalRide(0, 260);

    await page.goto('/');

    const section = dayGoal(page);
    await expect(
      section.getByText('No tier has requirements yet. Configure them in settings.')
    ).toBeVisible();
    await expect(achievedStatus(page)).toBeHidden();
    expect(await getAchievedDays()).toEqual([]);
  });

  test('counts each tier separately and streaks across tiers', async ({ page }) => {
    const dayOfMonth = startOfTodayUtc().getUTCDate();
    const tiers: DayGoalTier[] = (['GOLD', 'SILVER', 'BRONZE'] as const).slice(
      0,
      Math.min(3, dayOfMonth)
    );
    for (const [daysAgo, tier] of tiers.entries()) {
      await insertAchievedDay(isoDate(daysAgo), tier);
    }

    await page.goto('/');

    for (const [label, tier] of [
      ['Gold', 'GOLD'],
      ['Silver', 'SILVER'],
      ['Bronze', 'BRONZE'],
    ] as const) {
      const expected = tiers.includes(tier) ? '1' : '0';
      await expect(monthCount(page, label).getByText(expected, { exact: true })).toBeVisible();
    }
    await expect(streak(page).getByText(String(tiers.length), { exact: true })).toBeVisible();
    await expect(dayGoal(page).getByText('Today is a gold day')).toBeVisible();
  });
});
