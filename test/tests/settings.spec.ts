import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import {
  getBookRows,
  getGoldenDayDates,
  getGoldenDayGoal,
  getReadingProgressRows,
  insertBook,
  insertGoldenDay,
  insertPushupSet,
  insertReadingProgress,
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

const isoDate = (daysAgo: number) => {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
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

test.describe('Settings', () => {
  test('opens settings from the profile menu and shows current goals', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open profile menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByLabel('Daily pushup goal')).toHaveValue('100');
    await expect(page.getByLabel('Daily ride elevation goal')).toHaveValue('250');
    await expect(page.getByLabel('Daily reading goal')).toHaveValue('0');
  });

  test('saves new golden day goals', async ({ page }) => {
    await page.goto('/settings');

    await page.getByLabel('Daily pushup goal').fill('80');
    await page.getByLabel('Daily ride elevation goal').fill('200');
    await page.getByLabel('Daily reading goal').fill('20');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Settings saved')).toBeVisible();

    const goal = await getGoldenDayGoal();
    expect(goal.pushup_goal).toBe(80);
    expect(goal.elevation_goal).toBe(200);
    expect(goal.reading_pages_goal).toBe(20);
  });

  test('keeps today golden after raising goals', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 260);

    await page.goto('/');
    const goldenSection = page.getByRole('region', { name: 'Golden day' });
    await expect(goldenSection.getByText('Today is golden')).toBeVisible();

    expect(await getGoldenDayDates()).toContain(isoDate(0));

    await page.goto('/settings');
    await page.getByLabel('Daily pushup goal').fill('200');
    await page.getByLabel('Daily ride elevation goal').fill('500');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    await expect(goldenSection.getByText('Today is golden')).toBeVisible();
    expect(await getGoldenDayDates()).toContain(isoDate(0));
  });

  test('preserves previous golden days when goals are tightened', async ({ page }) => {
    const dayOfMonth = startOfTodayUtc().getUTCDate();
    const historical = Math.min(2, dayOfMonth - 1);
    const insertedDays: number[] = [];
    for (let d = historical; d >= 1; d--) {
      await insertGoldenDay(isoDate(d));
      insertedDays.push(d);
    }
    if (insertedDays.length === 0) {
      await insertGoldenDay(isoDate(0));
      insertedDays.push(0);
    }
    const expectedCount = String(insertedDays.length);

    await page.goto('/');
    const goldenSection = page.getByRole('region', { name: 'Golden day' });
    const month = goldenSection.getByText('This month').locator('..');
    await expect(month.getByText(expectedCount, { exact: true })).toBeVisible();

    await setGoldenDayGoal(500, 1000);

    await page.goto('/');
    await expect(month.getByText(expectedCount, { exact: true })).toBeVisible();
    expect(await getGoldenDayDates()).toEqual(insertedDays.map((d) => isoDate(d)));
  });

  test('reflects updated goals on the golden day card for today when not yet golden', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Daily pushup goal').fill('80');
    await page.getByLabel('Daily ride elevation goal').fill('150');
    await page.getByLabel('Daily reading goal').fill('20');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved')).toBeVisible();

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('0/80 pushups')).toBeVisible();
    await expect(section.getByText('0/150 m')).toBeVisible();
    await expect(section.getByText('0/20 pages')).toBeVisible();
  });

  test('marks today golden under lower goals once updated', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 60);
    await insertGoldenRide(0, 120);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('Today is golden')).toBeHidden();

    await setGoldenDayGoal(50, 100);

    await page.goto('/');
    await expect(section.getByText('Today is golden')).toBeVisible();
    expect(await getGoldenDayDates()).toContain(isoDate(0));
  });

  test('adds a new book through the settings form', async ({ page }) => {
    await page.goto('/settings');

    const booksSection = page.getByRole('region', { name: 'Books' });
    await booksSection.getByRole('button', { name: 'Add book' }).click();
    await booksSection.getByLabel('Title').fill('The Pragmatic Programmer');
    await booksSection.getByLabel('Author').fill('David Thomas');
    await booksSection.getByLabel('Total pages').fill('320');
    await booksSection.getByRole('button', { name: 'Add book' }).click();

    await expect(
      booksSection.getByRole('article', {
        name: 'The Pragmatic Programmer by David Thomas',
      })
    ).toBeVisible();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('The Pragmatic Programmer');
    expect(books[0].author).toBe('David Thomas');
    expect(books[0].total_pages).toBe(320);
  });

  test('removes a book and its progress entries from settings', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Removable', 'Author', 100, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 25, daysAgoAt(0, 12));

    await page.goto('/settings');
    const booksSection = page.getByRole('region', { name: 'Books' });
    await booksSection.getByRole('button', { name: 'Remove Removable' }).click();

    await expect(
      booksSection.getByRole('heading', { name: 'Removable' })
    ).toBeHidden();

    expect(await getBookRows()).toHaveLength(0);
    expect(await getReadingProgressRows()).toHaveLength(0);
  });

  test('keeps finished books listed in settings', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(
      bookId,
      'Finished Read',
      'Author',
      120,
      daysAgoAt(5, 8),
      daysAgoAt(0, 9)
    );

    await page.goto('/settings');
    const booksSection = page.getByRole('region', { name: 'Books' });
    await expect(
      booksSection.getByRole('heading', { name: 'Finished Read' })
    ).toBeVisible();
  });
});
