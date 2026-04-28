import { test, expect } from '../fixtures';
import {
  getGoldenDayGoalRows,
  insertPushupSet,
  insertRide,
  setGoldenDayGoal,
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

const todayIsoDate = () => startOfTodayUtc().toISOString().slice(0, 10);

const tomorrowIsoDate = () => {
  const tomorrow = startOfTodayUtc();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
};

test.describe('Settings', () => {
  test('opens settings from the profile menu and shows current goals', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open profile menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByLabel('Daily pushup goal')).toHaveValue('100');
    await expect(page.getByLabel('Daily ride elevation goal')).toHaveValue('250');
  });

  test('saves new golden day goals and applies them to today when today is not golden', async ({ page }) => {
    await page.goto('/settings');

    await page.getByLabel('Daily pushup goal').fill('80');
    await page.getByLabel('Daily ride elevation goal').fill('200');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Settings saved')).toBeVisible();

    const rows = await getGoldenDayGoalRows();
    expect(rows.length).toBe(2);
    const newest = rows[rows.length - 1];
    expect(newest.pushup_goal).toBe(80);
    expect(newest.elevation_goal).toBe(200);
    const effectiveFrom = new Date(newest.effective_from).toISOString().slice(0, 10);
    expect(effectiveFrom).toBe(todayIsoDate());
  });

  test('does not affect today when today is already golden', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 260);

    await page.goto('/');
    const goldenSection = page.getByRole('region', { name: 'Golden day' });
    await expect(goldenSection.getByText('Today is golden')).toBeVisible();

    await page.goto('/settings');
    await page.getByLabel('Daily pushup goal').fill('200');
    await page.getByLabel('Daily ride elevation goal').fill('500');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    const rows = await getGoldenDayGoalRows();
    expect(rows.length).toBe(2);
    const newest = rows[rows.length - 1];
    expect(newest.pushup_goal).toBe(200);
    expect(newest.elevation_goal).toBe(500);
    const effectiveFrom = new Date(newest.effective_from).toISOString().slice(0, 10);
    expect(effectiveFrom).toBe(tomorrowIsoDate());

    await page.goto('/');
    await expect(goldenSection.getByText('Today is golden')).toBeVisible();
  });

  test('preserves previous golden days when goals are tightened', async ({ page }) => {
    await insertPushupSet(daysAgoAt(2, 8), 100);
    await insertGoldenRide(2, 260);
    await insertPushupSet(daysAgoAt(1, 9), 100);
    await insertGoldenRide(1, 260);

    await page.goto('/');
    const goldenSection = page.getByRole('region', { name: 'Golden day' });
    const month = goldenSection.getByText('This month').locator('..');
    await expect(month.getByText('2', { exact: true })).toBeVisible();

    await page.goto('/settings');
    await page.getByLabel('Daily pushup goal').fill('500');
    await page.getByLabel('Daily ride elevation goal').fill('1000');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    await expect(month.getByText('2', { exact: true })).toBeVisible();
  });

  test('reflects updated goals on the golden day card for today when not yet golden', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Daily pushup goal').fill('80');
    await page.getByLabel('Daily ride elevation goal').fill('150');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('0/80 pushups')).toBeVisible();
    await expect(section.getByText('0/150 m')).toBeVisible();
  });

  test('shows seeded older goals when reopening the settings page', async ({ page }) => {
    await setGoldenDayGoal(120, 300, todayIsoDate());

    await page.goto('/settings');

    await expect(page.getByLabel('Daily pushup goal')).toHaveValue('120');
    await expect(page.getByLabel('Daily ride elevation goal')).toHaveValue('300');
  });
});
