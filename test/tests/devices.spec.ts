import { test, expect } from '../fixtures';
import { createDeviceViaUI, dropFileOnto } from '../device-helpers';
import {
  cleanupDb,
  decryptToken,
  getDeviceBookRows,
  getDeviceRows,
  populateOAuthClients,
} from '../utils';

const DEVICE_BOOKS_URL = 'http://localhost:8180/api/device/books';

async function listPendingBooks(apiKey: string | null): Promise<Response> {
  return await fetch(DEVICE_BOOKS_URL, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
}

test.describe('Devices', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('adds a device and downloads its API key', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');

    expect(apiKey.length).toBeGreaterThan(32);
    const section = page.getByRole('region', { name: 'Devices' });
    await expect(section.getByText('Kobo')).toBeVisible();

    const rows = await getDeviceRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Kobo');
    // Stored encrypted, not in cleartext...
    expect(rows[0].encrypted_key).not.toContain(apiKey);
    // ...but recoverable, so authentication can decrypt-and-compare.
    expect(decryptToken(rows[0].encrypted_key)).toBe(apiKey);
  });

  test('removes a device', async ({ page }) => {
    await createDeviceViaUI(page, 'Kobo');
    const section = page.getByRole('region', { name: 'Devices' });

    await section.getByRole('button', { name: 'Remove Kobo' }).click();

    await expect(
      section.getByText('No devices yet. Add one to connect an e-reader.')
    ).toBeVisible();
    expect(await getDeviceRows()).toHaveLength(0);
  });

  test('sends an ebook to a device by dropping it on the device card', async ({
    page,
  }) => {
    await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });

    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');

    await expect(device.getByText('clean-code.epub')).toBeVisible();
    await expect(device.getByText('Waiting for device')).toBeVisible();

    const books = await getDeviceBookRows();
    expect(books).toHaveLength(1);
    expect(books[0].file_name).toBe('clean-code.epub');
    expect(books[0].content_type).toBe('application/epub+zip');
    expect((books[0].data as Buffer).toString('utf-8')).toBe(
      'epub-binary-content'
    );

    const devices = await getDeviceRows();
    expect(books[0].device_id).toBe(devices[0].id);
  });

  test('removes a pending ebook from the queue in the web UI', async ({
    page,
  }) => {
    await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');
    await expect(device.getByText('clean-code.epub')).toBeVisible();

    await device
      .getByRole('button', { name: 'Remove clean-code.epub' })
      .click();

    await expect(device.getByText('clean-code.epub')).not.toBeVisible();
    expect(await getDeviceBookRows()).toHaveLength(0);
  });

  test('lists pending books for the device presenting its API key', async ({
    page,
  }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');
    await expect(device.getByText('clean-code.epub')).toBeVisible();

    const response = await listPendingBooks(apiKey);

    expect(response.status).toBe(200);
    const books = await response.json();
    expect(books).toHaveLength(1);
    expect(books[0].fileName).toBe('clean-code.epub');
    expect(books[0].id).toBeTruthy();
  });

  test('downloads a pending book and acknowledges it', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');
    await expect(device.getByText('clean-code.epub')).toBeVisible();

    const listResponse = await listPendingBooks(apiKey);
    const [book] = await listResponse.json();

    const fileResponse = await fetch(`${DEVICE_BOOKS_URL}/${book.id}/file`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.headers.get('content-type')).toBe(
      'application/epub+zip'
    );
    expect(fileResponse.headers.get('content-disposition')).toContain(
      'clean-code.epub'
    );
    expect(await fileResponse.text()).toBe('epub-binary-content');

    const ackResponse = await fetch(`${DEVICE_BOOKS_URL}/${book.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(ackResponse.status).toBe(204);

    expect(await getDeviceBookRows()).toHaveLength(0);
    const emptyList = await listPendingBooks(apiKey);
    expect(await emptyList.json()).toHaveLength(0);
  });

  test('only offers books queued for the presenting device', async ({
    page,
  }) => {
    await createDeviceViaUI(page, 'Kobo');
    const otherApiKey = await createDeviceViaUI(page, 'Kindle');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');
    await expect(device.getByText('clean-code.epub')).toBeVisible();

    const response = await listPendingBooks(otherApiKey);

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(0);
  });

  test('rejects the device API without an API key', async () => {
    const response = await listPendingBooks(null);
    expect(response.status).toBe(401);
  });

  test('rejects the device API with an invalid API key', async () => {
    const response = await listPendingBooks('invalid-key');
    expect(response.status).toBe(401);
  });

  test('deleting a device also removes its pending books', async ({
    page,
  }) => {
    await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'clean-code.epub', 'epub-binary-content');
    await expect(device.getByText('clean-code.epub')).toBeVisible();

    const section = page.getByRole('region', { name: 'Devices' });
    await section.getByRole('button', { name: 'Remove Kobo' }).click();
    await expect(
      section.getByText('No devices yet. Add one to connect an e-reader.')
    ).toBeVisible();

    expect(await getDeviceRows()).toHaveLength(0);
    expect(await getDeviceBookRows()).toHaveLength(0);
  });
});
