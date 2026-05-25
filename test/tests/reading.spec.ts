import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getBookRows,
  getReadingProgressRows,
  insertBook,
  insertReadingProgress,
  populateOAuthClients,
  setGoals,
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
    await setGoals(100, 250, 30);
    await page.goto('/');

    const section = page.getByRole('region', { name: 'Reading' });
    await expect(section).toBeVisible();
    await expect(
      section.getByText('No books in progress. Add a book in Settings.')
    ).toBeVisible();

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(
      library.getByText('No books yet. Add your first one to get started.')
    ).toBeVisible();
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
    expect(books[0].starting_page).toBe(0);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('heading', { name: 'The Pragmatic Programmer' })
    ).toBeVisible();
  });

  test('adds a book with a starting page already read', async ({ page }) => {
    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });

    await library.getByRole('button', { name: 'Add book' }).click();
    await library.getByLabel('Title').fill('Already Started');
    await library.getByLabel('Author').fill('Author');
    await library.getByLabel('Total pages').fill('300');
    await library.getByLabel('Starting page').fill('80');
    await library.getByRole('button', { name: 'Add book' }).click();

    await expect(
      library.getByRole('heading', { name: 'Already Started' })
    ).toBeVisible();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].starting_page).toBe(80);
    expect(books[0].total_pages).toBe(300);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('button', { name: /Already Started, 80 of 300 pages/ })
    ).toBeVisible();
  });

  test('starting page acts as baseline and does not inflate reading pace', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(
      bookId,
      'Resumed Book',
      'Author',
      300,
      daysAgoAt(4, 8),
      null,
      100
    );
    await insertReadingProgress(bookId, 100, daysAgoAt(4, 8));
    await insertReadingProgress(bookId, 140, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    const book = section.getByRole('button', {
      name: /Resumed Book, 140 of 300 pages/,
    });
    await expect(book).toBeVisible();
    await expect(book.getByText('8.0', { exact: true })).toBeVisible();
    await expect(book.getByText('20', { exact: true })).toBeVisible();
    await expect(book.getByText('days left')).toBeVisible();
  });

  test('only counts pages read past the starting page toward the daily goal', async ({
    page,
  }) => {
    await setGoals(100, 250, 30);
    const bookId = randomUUID();
    await insertBook(
      bookId,
      'Resumed Book',
      'Author',
      300,
      daysAgoAt(1, 8),
      null,
      100
    );
    await insertReadingProgress(bookId, 115, daysAgoAt(0, 12));

    await page.goto('/');
    const golden = page.getByRole('region', { name: 'Golden day' });
    await expect(golden.getByText('15/30 pages')).toBeVisible();
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
    await insertReadingProgress(bookId, 120, daysAgoAt(1, 8));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await section.getByRole('button', { name: /Clean Code/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Clean Code' });
    const dial = dialog.getByRole('slider', { name: 'Page' });
    await expect(dial).toHaveAttribute('aria-valuenow', '120');
    await dial.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('PageUp');
    }
    await expect(dial).toHaveAttribute('aria-valuenow', '125');
    await dialog.getByRole('button', { name: 'Save 125' }).click();
    await expect(dialog).toBeHidden();

    await expect(
      section.getByRole('button', { name: /Clean Code, 125 of 400 pages/ })
    ).toBeVisible();

    const progress = await getReadingProgressRows();
    expect(progress).toHaveLength(2);
    expect(progress.at(-1)?.current_page).toBe(125);
  });

  test('aggregates pages read across books toward the daily goal', async ({ page }) => {
    await setGoals(100, 250, 30);
    const bookA = randomUUID();
    const bookB = randomUUID();
    await insertBook(bookA, 'Book A', 'Author A', 200, daysAgoAt(1, 8));
    await insertBook(bookB, 'Book B', 'Author B', 200, daysAgoAt(1, 9));
    await insertReadingProgress(bookA, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookB, 0, daysAgoAt(1, 9));
    await insertReadingProgress(bookA, 12, daysAgoAt(0, 7));
    await insertReadingProgress(bookB, 8, daysAgoAt(0, 12));

    await page.goto('/');
    const golden = page.getByRole('region', { name: 'Golden day' });
    await expect(golden.getByText('20/30 pages')).toBeVisible();
  });

  test('shows daily goal reached when total pages match the goal', async ({ page }) => {
    await setGoals(100, 250, 30);
    const bookId = randomUUID();
    await insertBook(bookId, 'Book', 'Author', 200, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 30, daysAgoAt(0, 12));

    await page.goto('/');
    const golden = page.getByRole('region', { name: 'Golden day' });
    await expect(golden.getByText('30/30 pages')).toBeVisible();
  });

  test('shows estimated days to finish based on reading velocity', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Long Book', 'Author', 300, daysAgoAt(4, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(4, 8));
    await insertReadingProgress(bookId, 100, daysAgoAt(0, 12));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    const book = section.getByRole('button', { name: /Long Book/ });
    await expect(book.getByText(/days? left/)).toBeVisible();
    await expect(book.getByText('pages/day')).toBeVisible();
  });

  test('marks a book as finished when current page reaches total pages', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Almost Done', 'Author', 100, daysAgoAt(2, 8));

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await section.getByRole('button', { name: /Almost Done/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Almost Done' });
    const dial = dialog.getByRole('slider', { name: 'Page' });
    await dial.focus();
    await page.keyboard.press('End');
    await expect(dial).toHaveAttribute('aria-valuenow', '100');
    await dialog.getByRole('button', { name: 'Save 100' }).click();
    await expect(dialog).toBeHidden();

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

  test('copies author and title to the clipboard from the settings page', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const bookId = randomUUID();
    await insertBook(bookId, 'Deep Work', 'Cal Newport', 300, daysAgoAt(1, 8));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Copy Deep Work' }).click();

    await expect(page.getByText('Copied to clipboard')).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toBe('Cal Newport - Deep Work');
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

  test('adds a wanted book without a page count and hides it from the dashboard', async ({
    page,
  }) => {
    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });

    await library.getByRole('button', { name: 'Add book' }).click();
    await library.getByLabel('Title').fill('Some Day');
    await library.getByLabel('Author').fill('Future Author');
    await library.getByRole('button', { name: 'Add book' }).click();

    await expect(
      library.getByRole('heading', { name: 'Wanted list' })
    ).toBeVisible();
    await expect(
      library.getByRole('heading', { name: 'Some Day' })
    ).toBeVisible();
    await expect(library.getByText('Page count not set')).toBeVisible();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].total_pages).toBeNull();
    expect(books[0].starting_page).toBe(0);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('heading', { name: 'Some Day' })
    ).toBeHidden();
    await expect(
      section.getByText('No books in progress. Add a book in Settings.')
    ).toBeVisible();
  });

  test('edits an existing book through the settings page', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Old Title', 'Old Author', 200, daysAgoAt(1, 8));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Edit Old Title' }).click();

    await library.getByLabel('Title').fill('New Title');
    await library.getByLabel('Author').fill('New Author');
    await library.getByLabel('Total pages').fill('250');
    await library.getByRole('button', { name: 'Save book' }).click();

    await expect(
      library.getByRole('heading', { name: 'New Title' })
    ).toBeVisible();
    await expect(library.getByText('New Author')).toBeVisible();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('New Title');
    expect(books[0].author).toBe('New Author');
    expect(books[0].total_pages).toBe(250);
  });

  test('restores the book card when an edit is cancelled', async ({ page }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Keep Me', 'Author', 200, daysAgoAt(1, 8));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Edit Keep Me' }).click();

    await expect(
      library.getByRole('heading', { name: 'Edit book' })
    ).toBeVisible();
    await library.getByLabel('Title').fill('Different Title');
    await library.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      library.getByRole('heading', { name: 'Edit book' })
    ).toBeHidden();
    await expect(
      library.getByRole('heading', { name: 'Keep Me' })
    ).toBeVisible();
    await expect(
      library.getByRole('heading', { name: 'Different Title' })
    ).toBeHidden();

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Keep Me');
  });

  test('rejects an edit that sets the starting page above the current page', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Halfway Book', 'Author', 300, daysAgoAt(2, 8));
    await insertReadingProgress(bookId, 50, daysAgoAt(0, 12));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Edit Halfway Book' }).click();
    await library.getByLabel('Starting page').fill('150');
    await library.getByRole('button', { name: 'Save book' }).click();

    await expect(page.getByText('Unable to update book')).toBeVisible();

    const books = await getBookRows();
    expect(books[0].starting_page).toBe(0);
  });

  test('rejects an edit that lowers total pages below the current page', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Too Far In', 'Author', 300, daysAgoAt(2, 8));
    await insertReadingProgress(bookId, 150, daysAgoAt(0, 12));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Edit Too Far In' }).click();
    await library.getByLabel('Total pages').fill('100');
    await library.getByRole('button', { name: 'Save book' }).click();

    await expect(page.getByText('Unable to update book')).toBeVisible();

    const books = await getBookRows();
    expect(books[0].total_pages).toBe(300);
  });

  test('moves a book to the wanted list when its page count is cleared', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'On The Fence', 'Author', 200, daysAgoAt(1, 8));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await library.getByRole('button', { name: 'Edit On The Fence' }).click();
    await library.getByLabel('Total pages').fill('');
    await library.getByRole('button', { name: 'Save book' }).click();

    await expect(
      library.getByRole('heading', { name: 'Wanted list' })
    ).toBeVisible();
    await expect(
      library.getByRole('heading', { name: 'Reading in progress' })
    ).toBeHidden();

    const books = await getBookRows();
    expect(books[0].total_pages).toBeNull();
    expect(books[0].starting_page).toBe(0);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('heading', { name: 'On The Fence' })
    ).toBeHidden();
  });

  test('moves a wanted book to reading in progress when a page count is added', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Wanted Book', 'Author', null, daysAgoAt(1, 8));

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });

    await expect(
      library.getByRole('heading', { name: 'Wanted list' })
    ).toBeVisible();
    await library.getByRole('button', { name: 'Edit Wanted Book' }).click();
    await library.getByLabel('Total pages').fill('180');
    await library.getByRole('button', { name: 'Save book' }).click();

    await expect(
      library.getByRole('heading', { name: 'Wanted list' })
    ).toBeHidden();
    await expect(
      library.getByRole('heading', { name: 'Reading in progress' })
    ).toBeVisible();

    const books = await getBookRows();
    expect(books[0].total_pages).toBe(180);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Reading' });
    await expect(
      section.getByRole('button', { name: /Wanted Book, 0 of 180 pages/ })
    ).toBeVisible();
  });

  test('reflects the configured daily reading goal', async ({ page }) => {
    await setGoals(100, 250, 50);
    const bookId = randomUUID();
    await insertBook(bookId, 'Book', 'Author', 200, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 0, daysAgoAt(1, 8));
    await insertReadingProgress(bookId, 20, daysAgoAt(0, 12));

    await page.goto('/');
    const golden = page.getByRole('region', { name: 'Golden day' });
    await expect(golden.getByText('20/50 pages')).toBeVisible();
  });
});
