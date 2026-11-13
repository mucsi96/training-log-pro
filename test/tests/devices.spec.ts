import { test, expect } from '../fixtures';
import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createDeviceViaUI, dropFileOnto } from '../device-helpers';
import {
  cleanupDb,
  decryptToken,
  getDeviceBookRows,
  getDeviceRows,
  populateOAuthClients,
  query,
} from '../utils';

const DEVICE_BOOKS_URL = 'http://localhost:8180/api/device/books';
const storagePath = (name: string) => resolve(__dirname, '../device-book-storage', name);

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
    expect(books[0].data).toBeNull();
    expect(Number(books[0].file_size)).toBe(Buffer.byteLength('epub-binary-content'));
    expect(readFileSync(storagePath(`${books[0].id}.epub`), 'utf-8')).toBe('epub-binary-content');

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

    const [book] = await getDeviceBookRows();
    await device
      .getByRole('button', { name: 'Remove clean-code.epub' })
      .click();

    await expect(device.getByText('clean-code.epub')).not.toBeVisible();
    expect(await getDeviceBookRows()).toHaveLength(0);
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(false);
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
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(true);

    const ackResponse = await fetch(`${DEVICE_BOOKS_URL}/${book.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(ackResponse.status).toBe(204);
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(false);

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

    const [book] = await getDeviceBookRows();
    for (const [suffix, method] of [['/file', 'GET'], ['', 'DELETE']]) {
      const denied = await fetch(`${DEVICE_BOOKS_URL}/${book.id}${suffix}`, {
        method,
        headers: { Authorization: `Bearer ${otherApiKey}` },
      });
      expect(denied.status).toBe(404);
    }
    expect(await getDeviceBookRows()).toHaveLength(1);
  });

  test('transfers a large binary ebook intact with concurrent downloads', async ({ page }) => {
    test.setTimeout(180_000);
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    // Nearly the upload limit, incompressible, and not a multiple of the read chunk size.
    // Both server (384Mi) and PostgreSQL (300Mi) use their production memory limits.
    const size = 96 * 1024 * 1024 + 17;
    const payload = await page.evaluateHandle(async (size) => {
      const bytes = new Uint8Array(size);
      for (let offset = 0; offset < size; offset += 65536) {
        crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, size)));
      }
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], 'large.epub', { type: 'application/epub+zip' }));
      return { hash, dataTransfer };
    }, size);
    const expectedHash = await payload.evaluate(value => value.hash);
    const dataTransfer = await payload.getProperty('dataTransfer');
    await device.dispatchEvent('drop', { dataTransfer });
    await expect(device.getByText('large.epub')).toBeVisible({ timeout: 60_000 });
    await payload.dispose();
    await dataTransfer.dispose();

    const response = await listPendingBooks(apiKey);
    const [book] = await response.json();
    const [stored] = await getDeviceBookRows();
    expect(stored.data).toBeNull();
    expect(Number(stored.file_size)).toBe(size);
    const abort = new AbortController();
    const interrupted = await fetch(`${DEVICE_BOOKS_URL}/${book.id}/file`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: abort.signal,
    });
    expect(interrupted.status).toBe(200);
    abort.abort();
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(true);
    await Promise.all([0, 1].map(async () => {
      const download = await fetch(`${DEVICE_BOOKS_URL}/${book.id}/file`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      expect(download.status).toBe(200);
      expect(download.headers.get('content-length')).toBe(String(size));
      const hash = createHash('sha256');
      for await (const chunk of download.body!) {
        hash.update(chunk);
      }
      expect(hash.digest('hex')).toBe(expectedHash);
    }));

    const ack = await fetch(`${DEVICE_BOOKS_URL}/${book.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(ack.status).toBe(204);
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(false);
    expect(await getDeviceBookRows()).toHaveLength(0);
    const missing = await fetch(`${DEVICE_BOOKS_URL}/${book.id}/file`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(missing.status).toBe(404);
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
    const [book] = await getDeviceBookRows();

    const section = page.getByRole('region', { name: 'Devices' });
    await section.getByRole('button', { name: 'Remove Kobo' }).click();
    await expect(
      section.getByText('No devices yet. Add one to connect an e-reader.')
    ).toBeVisible();

    expect(await getDeviceRows()).toHaveLength(0);
    expect(await getDeviceBookRows()).toHaveLength(0);
    expect(existsSync(storagePath(`${book.id}.epub`))).toBe(false);
  });

  test('cleans stuck transfers on a new upload without removing fresh queued books', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'expired.epub', 'old-file');
    await expect(device.getByText('expired.epub')).toBeVisible();
    const [expired] = await getDeviceBookRows();
    await query("UPDATE training_log.device_book SET created_at = created_at - interval '25 hours' WHERE id = $1", [expired.id]);
    const orphan = `${randomUUID()}.epub`;
    const partial = `${randomUUID()}.part`;
    writeFileSync(storagePath(orphan), 'orphan');
    writeFileSync(storagePath(partial), 'interrupted upload');

    await dropFileOnto(device, 'fresh.epub', 'fresh-file');
    await expect(device.getByText('fresh.epub')).toBeVisible();
    expect(existsSync(storagePath(`${expired.id}.epub`))).toBe(false);
    expect(existsSync(storagePath(orphan))).toBe(false);
    expect(existsSync(storagePath(partial))).toBe(false);
    const response = await listPendingBooks(apiKey);
    const books = await response.json();
    expect(books).toHaveLength(1);
    expect(books[0].fileName).toBe('fresh.epub');
    expect(existsSync(storagePath(`${books[0].id}.epub`))).toBe(true);
  });

  test('downloads previously queued database books and migrates their bytes to disk', async ({ page }) => {
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const [device] = await getDeviceRows();
    const id = randomUUID();
    const bytes = Buffer.from([0, 255, 128, 42, 0, 17]);
    await query(`INSERT INTO training_log.device_book
      (id, device_id, file_name, content_type, data, created_at)
      VALUES ($1, $2, 'legacy.epub', 'application/epub+zip', $3, $4)`,
      [id, device.id, bytes, device.created_at]);
    const response = await fetch(`${DEVICE_BOOKS_URL}/${id}/file`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(readFileSync(storagePath(`${id}.epub`))).toEqual(bytes);
    const [book] = await getDeviceBookRows();
    expect(book.data).toBeNull();
    expect(Number(book.file_size)).toBe(bytes.length);
  });

  test('keeps queued files across a server restart and cleans abandoned files at startup', async ({ page }) => {
    test.setTimeout(90_000);
    const apiKey = await createDeviceViaUI(page, 'Kobo');
    const device = page.getByRole('article', { name: 'Kobo' });
    await dropFileOnto(device, 'retained.epub', 'survives-restart');
    await expect(device.getByText('retained.epub')).toBeVisible();
    const [book] = await getDeviceBookRows();
    const partial = `${randomUUID()}.part`;
    writeFileSync(storagePath(partial), 'interrupted upload');
    await promisify(execFile)('podman', ['restart', 'training-log-pro-test-server']);
    // Check disk first: no queue request should trigger cleanup before this assertion.
    await expect.poll(() => existsSync(storagePath(partial)), { timeout: 30_000 }).toBe(false);
    const response = await fetch(`${DEVICE_BOOKS_URL}/${book.id}/file`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('survives-restart');
  });
});
