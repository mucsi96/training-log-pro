import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import { getReadingProgressRows, insertBook } from '../utils';

test('rejects malformed book responses and retries without reloading the document', async ({ page }) => {
  await insertBook(randomUUID(), 'Validated response', 'Author', 100);
  await page.route('**/api/reading/books', route => route.fulfill({ json: [{ id: 'missing-required-fields' }] }));
  await page.goto('/');
  const reading = page.getByRole('region', { name: 'Reading', exact: true });
  await expect(reading.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/reading/books');
  await reading.getByRole('button', { name: 'Retry' }).click();
  await expect(reading.getByRole('button', { name: 'Validated response, 0 of 100 pages' })).toBeVisible();
});

test('retains a failed reading session for retry and persists it only once', async ({ page }) => {
  const id = randomUUID();
  await insertBook(id, 'Retry session', 'Author', 100);
  await page.goto('/');
  await page.getByRole('button', { name: 'Retry session, 0 of 100 pages' }).click();
  const dialog = page.getByRole('dialog', { name: 'Retry session' });
  await dialog.getByRole('slider', { name: 'Page' }).focus();
  await page.keyboard.press('ArrowUp');
  await dialog.getByRole('slider', { name: 'Minutes' }).focus();
  await page.keyboard.press('ArrowUp');
  await page.route(`**/api/reading/books/${id}/progress`, route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
  await dialog.getByRole('button', { name: 'Save 1', exact: true }).click();
  await expect(page.getByText('Unable to update progress')).toBeVisible();
  await expect(dialog.getByRole('slider', { name: 'Page' })).toHaveAttribute('aria-valuenow', '1');
  expect(await getReadingProgressRows()).toHaveLength(0);
  await page.unroute(`**/api/reading/books/${id}/progress`);
  await dialog.getByRole('button', { name: 'Save 1', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Retry session, 1 of 100 pages' })).toBeVisible();
  expect(await getReadingProgressRows()).toHaveLength(1);
});

test('refreshes cached goals after saving settings through client-side navigation', async ({ page }) => {
  await page.goto('/');
  const goal = page.getByRole('region', { name: 'Day goal' });
  await expect(goal.getByText('0/100 pushups')).toBeVisible();
  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('group', { name: 'Gold' }).getByLabel('Pushups goal').fill('80');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('link', { name: 'Tracker' }).click();
  await expect(goal.getByText('0/80 pushups')).toBeVisible();
});

test('deduplicates provider syncs across dashboard tabs and range navigation', async ({ page }) => {
  const syncs: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/(withings\/sync|strava\/activities\/sync)$/.test(request.url())) syncs.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Day goal' }).getByText('Next: gold')).toBeVisible();
  await page.getByRole('tab', { name: 'Training' }).click();
  await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();
  await page.getByRole('button', { name: /Range/ }).click();
  await page.getByRole('option', { name: 'Year', exact: true }).click();
  await expect(page).toHaveURL(/\/year\?view=training$/);
  await page.getByRole('tab', { name: 'Health' }).click();
  await expect(page.getByRole('heading', { name: 'Weight', exact: true })).toBeVisible();
  expect(syncs).toEqual(['/api/withings/sync', '/api/strava/activities/sync']);
});
