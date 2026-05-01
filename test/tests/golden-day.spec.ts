import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import {
  cleanupDb,
  insertBook,
  insertPushupSet,
  insertReadingProgress,
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

const insertGoldenReading = async (daysAgo: number, pages: number) => {
  const bookId = randomUUID();
  const created = daysAgoAt(daysAgo, 6);
  const finished = daysAgoAt(daysAgo, 20);
  await insertBook(bookId, `Book d-${daysAgo}`, 'Author', pages + 100, created);
  await insertReadingProgress(bookId, 0, created);
  await insertReadingProgress(bookId, pages, finished);
};

test.describe('Golden day', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows zero state when there are no golden days', async ({ page }) => {
    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section).toBeVisible();
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('0', { exact: true })).toBeVisible();
    const streak = section.getByText('Streak').locator('..');
    await expect(streak.getByText('0', { exact: true })).toBeVisible();
    await expect(section.getByText('0/100 pushups')).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeHidden();
  });

  test('counts golden days for the current month and shows the streak', async ({ page }) => {
    const dayOfMonth = startOfTodayUtc().getUTCDate();
    const total = Math.min(3, dayOfMonth);

    for (let d = total - 1; d >= 0; d--) {
      await insertPushupSet(daysAgoAt(d, 7 + d), 100);
      await insertGoldenRide(d, 250 + d * 25);
      await insertGoldenReading(d, 30);
    }

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText(String(total), { exact: true })).toBeVisible();
    const streak = section.getByText('Streak').locator('..');
    await expect(streak.getByText(String(total), { exact: true })).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeVisible();
  });

  test('does not count days that meet only one goal', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('0', { exact: true })).toBeVisible();
    const streak = section.getByText('Streak').locator('..');
    await expect(streak.getByText('0', { exact: true })).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeHidden();
  });

  test('lights up when today becomes golden after adding pushups', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 95);
    await insertGoldenRide(0, 260);
    await insertGoldenReading(0, 30);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('95/100 pushups')).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeHidden();

    const pushups = page.getByRole('region', { name: 'Pushups' });
    await pushups.getByRole('button', { name: 'Add 10 pushups' }).click();

    await expect(section.getByText('Today is golden')).toBeVisible();
    const month = section.getByText('This month').locator('..');
    await expect(month.getByText('1', { exact: true })).toBeVisible();
  });
});
