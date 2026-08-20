import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import { createDeviceViaUI } from '../device-helpers';
import {
  cleanupDb,
  getBookRows,
  getReadingProgressRows,
  insertBook,
  populateOAuthClients,
} from '../utils';

const SYNC_URL = 'http://localhost:8180/api/reading/koreader-sync';

type SyncBody = {
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
};

async function sync(apiKey: string | null, body: SyncBody): Promise<Response> {
  return await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test.describe('KOReader sync', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('registers a new book on first sync', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    const response = await sync(apiKey, {
      title: 'The Pragmatic Programmer',
      author: 'David Thomas',
      totalPages: 320,
      currentPage: 12,
    });

    expect(response.status).toBe(204);

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('The Pragmatic Programmer');
    expect(books[0].author).toBe('David Thomas');
    expect(books[0].total_pages).toBe(320);
    expect(books[0].starting_page).toBe(0);

    const progress = await getReadingProgressRows();
    expect(progress).toHaveLength(1);
    expect(progress[0].current_page).toBe(12);

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(
      library.getByRole('heading', { name: 'The Pragmatic Programmer' })
    ).toBeVisible();
    await expect(library.getByText('12 / 320 pages')).toBeVisible();
  });

  test('records progress for an existing book without duplicating it', async ({
    page,
  }) => {
    const bookId = randomUUID();
    await insertBook(bookId, 'Clean Code', 'Robert C. Martin', 464);
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    const response = await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    });

    expect(response.status).toBe(204);

    const books = await getBookRows();
    expect(books).toHaveLength(1);

    const progress = await getReadingProgressRows();
    expect(progress).toHaveLength(1);
    expect(progress[0].book_id).toBe(bookId);
    expect(progress[0].current_page).toBe(100);
  });

  test('does not record duplicate progress for an unchanged page', async ({
    page,
  }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const body = {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    };

    await sync(apiKey, body);
    const response = await sync(apiKey, body);

    expect(response.status).toBe(204);
    expect(await getReadingProgressRows()).toHaveLength(1);
  });

  test('marks the book completed when the last page is reached', async ({
    page,
  }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 464,
    });

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].completed_at).not.toBeNull();

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Books' });
    await expect(library.getByText('Already read')).toBeVisible();
    await expect(
      library.getByRole('heading', { name: 'Clean Code' })
    ).toBeVisible();
  });

  test('adopts a new page count when KOReader rendering changes', async ({
    page,
  }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    });
    await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 520,
      currentPage: 110,
    });

    const books = await getBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].total_pages).toBe(520);

    const progress = await getReadingProgressRows();
    expect(progress).toHaveLength(2);
    expect(progress[1].current_page).toBe(110);
  });

  test('rejects a sync with currentPage beyond totalPages', async ({
    page,
  }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    const response = await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 465,
    });

    expect(response.status).toBe(400);
    expect(await getBookRows()).toHaveLength(0);
  });

  test('rejects a sync without an API key', async () => {
    const response = await sync(null, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    });

    expect(response.status).toBe(401);
    expect(await getBookRows()).toHaveLength(0);
  });

  test('rejects a sync with an invalid API key', async () => {
    const response = await sync('invalid-key', {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    });

    expect(response.status).toBe(401);
    expect(await getBookRows()).toHaveLength(0);
  });

  test('rejects a sync after the device is removed', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const section = page.getByRole('region', { name: 'Devices' });
    await section.getByRole('button', { name: 'Remove Kobo' }).click();
    await expect(
      section.getByText('No devices yet. Add one to connect an e-reader.')
    ).toBeVisible();

    const response = await sync(apiKey, {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      totalPages: 464,
      currentPage: 100,
    });

    expect(response.status).toBe(401);
  });
});
