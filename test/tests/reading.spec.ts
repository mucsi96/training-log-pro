import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getBookRows,
  getReadingProgressRows,
  insertBook,
  insertReadingProgress,
  populateOAuthClients,
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

test.describe('Reading', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows empty state when no books exist', async ({ page }) => {
    await setGoldenDayGoal(100, 250, 30);
    await page.goto('/');

    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section).toBeVisible();
    await expect(
      section.getByText('No books in progress. Add a book in Settings.')
    ).toBeVisible();
    await expect(section.getByRole('img', { name: '0 of 30 pages today' })).toBeVisible();

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(
      library.getByText('No books yet. Add your first one to get started.')
    ).toBeVisible();
  });

  test('hides daily goal ring when reading goal is 0', async ({ page }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section).toBeVisible();
    await expect(section.getByRole('img', { name: /pages today/ })).toBeHidden();
  });

  test('adds a new book through the settings page', async ({ page }) => {
    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });

    await library.getByRole('button', { name: 'Add book' }).click();
    await library.getByLabel('Title').fill('The Pragmatic Programmer');
    await library.getByLabel('Author').fill('David Thomas');
    await library.getByLabel('Total pages').fill('320');
    await library.getByRole('button', { name: 'Add book' }).click();

    await expect(
      library.getByRole('heading', { name: 'The Pragmatic Programmer' })
    ).toBeVisible();
    await expect(library.getByText('David Thomas')).toBeVisible();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('The Pragmatic Programmer');
    expect(books[0].author).toBe('David Thomas');
    expect(books[0].total_pages).toBe(320);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('heading', { name: 'The Pragmatic Programmer' })
    ).toBeVisible();
  });

  test('does not expose book add or remove controls on the dashboard', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Dashboard Only', 'Author', 200, daysAgoAt(1, 8));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('button', { name: 'Add book' })
    ).toHaveCount(0);
    await expect(
      section.getByRole('button', { name: 'Remove Dashboard Only' })
    ).toHaveCount(0);
  });

  test('updates reading progress for a book', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Clean Code', 'Robert Martin', 400, daysAgoAt(2, 8));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    const input = section.getByLabel('Current page for Clean Code');
    await input.fill('120');
    await section.getByRole('button', { name: 'Save' }).click();

    await expect(
      section.getByRole('article', { name: /Clean Code, 120 of 400 pages/ })
    ).toBeVisible();

    const progress = await getReadingProgressRows();
    expect(progress).toHaveLength(1);
    expect(progress[0].current_page).toBe(120);
  });

  test('aggregates pages read across books toward the daily goal', async ({ page }) => {
    await setGoldenDayGoal(100, 250, 30);
    const bookA = randomUUID();
    const bookB = randomUUID();
    await insertBook(bookA, 'Book A', 'Author A', 200, daysAgoAt(1, 8));
    await insertBook(bookB, 'Book B', 'Author B', 200, daysAgoAt(1, 9));
    await insertReadingProgress(bookA, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookB, 0, daysAgoAt(1, 9));
    await insertReadingProgress(bookA, 12, daysAgoAt(0, 7));
    await insertReadingProgress(bookB, 8, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section.getByRole('img', { name: '20 of 30 pages today' })).toBeVisible();
    await expect(section.getByText('10 pages to go')).toBeVisible();
  });

  test('shows daily goal reached when total pages match the goal', async ({ page }) => {
    await setGoldenDayGoal(100, 250, 30);
    const bookId = randomUUID();
    await insertBook(bookId, 'Book', 'Author', 200, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 30, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section.getByRole('img', { name: '30 of 30 pages today' })).toBeVisible();
    await expect(section.getByText('Daily goal reached')).toBeVisible();
  });

  test('shows estimated days to finish based on reading velocity', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Long Book', 'Author', 300, daysAgoAt(4, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(4, 8));
    await insertReadingProgress(bookId, 100, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section.getByText(/About \d+ days? to finish/)).toBeVisible();
    await expect(section.getByText(/pages\/day avg/)).toBeVisible();
  });

  test('marks a book as finished when current page reaches total pages', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Almost Done', 'Author', 100, daysAgoAt(2, 8));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await section.getByLabel('Current page for Almost Done').fill('100');
    await section.getByRole('button', { name: 'Save' }).click();

    await expect(
      section.getByRole('heading', { name: 'Almost Done' })
    ).toBeHidden();

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(
      library.getByRole('article', {
        name: /Almost Done, 100 of 100 pages, finished/,
      })
    ).toBeVisible();

    const books = await getBookRows();
    expect(books[0].completed_at).not.toBeNull();
  });

  test('removes a book and its progress entries from the settings page', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Removable', 'Author', 100, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 25, daysAgoAt(0, 12));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Remove Removable' }).click();

    await expect(
      library.getByRole('heading', { name: 'Removable' })
    ).toBeHidden();

    expect(await getBookRows()).toHaveLength(0);
    expect(await getReadingProgressRows()).toHaveLength(0);
  });

  test('shows finished books only on the settings page', async ({ page }) => {
    const bookId = randomUUID();
    const finishedAt = daysAgoAt(1, 12);
    await insertBook(
      bookId,
      'Already Finished',
      'Author',
      150,
      daysAgoAt(5, 8),
      finishedAt
    );

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('heading', { name: 'Already Finished' })
    ).toBeHidden();

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(
      library.getByRole('heading', { name: 'Already Finished' })
    ).toBeVisible();
    await expect(
      library.getByRole('article', {
        name: /Already Finished, 0 of 150 pages, finished/,
      })
    ).toBeVisible();
  });

  test('reflects the configured daily reading goal', async ({ page }) => {
    await setGoldenDayGoal(100, 250, 50);
    const bookId = randomUUID();
    await insertBook(bookId, 'Book', 'Author', 200, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 20, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section.getByRole('img', { name: '20 of 50 pages today' })).toBeVisible();
    await expect(section.getByText('30 pages to go')).toBeVisible();
  });
});
