import { randomUUID } from 'node:crypto';
import { test, expect } from '../fixtures';
import { encryptToken, query, withMigrationDatabase, insertBook, getReadingProgressRows } from '../utils';

test('delivers large ebooks with Unicode filenames', async ({ page, apiHeaders }) => {
  await page.request.get('/api/environment', { headers: apiHeaders });
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')!;
  const headers = { ...apiHeaders, 'X-XSRF-TOKEN': csrf.value, 'X-Timezone': 'UTC' };
  const created = await page.request.post('/api/devices', { headers, data: { name: 'Large book reader' } });
  expect(created.status()).toBe(200);
  const device = await created.json();
  const contents = Buffer.alloc(3 * 1024 * 1024, 42);
  const uploaded = await page.request.post(`/api/devices/${device.id}/books`, {
    headers, multipart: { file: { name: 'Árvíz book.epub', mimeType: 'application/epub+zip', buffer: contents } },
  });
  expect(uploaded.status()).toBe(200);
  const book = await uploaded.json();
  const delivered = await page.request.get(`/api/device/books/${book.id}/file`, {
    headers: { Authorization: `Bearer ${device.apiKey}` },
  });
  expect(delivered.status()).toBe(200);
  expect(delivered.headers()['content-disposition']).toContain("filename*=UTF-8''%C3%81rv%C3%ADz%20book.epub");
  expect(await delivered.body()).toEqual(contents);
});

test('initializes a fresh database and adopts existing rows without reseeding or re-encryption', async () => {
  await withMigrationDatabase(async (db, migrate) => {
    await migrate();
    expect((await db.query('SELECT goal FROM training_log.day_goal_requirement ORDER BY goal')).rows)
      .toEqual([{ goal: 100 }, { goal: 250 }]);
    const id = randomUUID();
    const key = encryptToken('existing-device-key').toString();
    await db.query(`INSERT INTO training_log.book VALUES ($1, 'Existing book', 'Author', 200, 20, '2025-01-02', NULL)`, [id]);
    await db.query(`INSERT INTO training_log.reading_progress VALUES ($1, '2025-01-03', $2, 40, NULL)`, [randomUUID(), id]);
    await db.query(`INSERT INTO training_log.device VALUES ($1, 'Reader', $2, '2025-01-02')`, [id, key]);
    await db.query(`INSERT INTO training_log.achieved_day VALUES ('2025-01-03', '2025-01-03', '2025-01-03', 'GOLD')`);
    await db.query(`UPDATE training_log.settings SET coins_reset_at = '2024-02-03'`);
    await db.query(`UPDATE training_log.day_goal_requirement SET goal = 123 WHERE metric = 'PUSHUPS'`);
    // The final deployed Liquibase schema has no SeaORM marker yet.
    await db.query('DROP TABLE training_log.seaql_migrations');
    await db.query('CREATE TABLE training_log.databasechangelog (id varchar(255))');
    await db.query(`INSERT INTO training_log.databasechangelog VALUES ('37-time-based-reading-goals')`);
    const tables = ['book', 'reading_progress', 'device', 'achieved_day', 'settings', 'day_goal_requirement'];
    const snapshot = () => tables.reduce<Promise<unknown[]>>(async (previous, table) => {
      const rows = await previous;
      const result = await db.query(`SELECT row_to_json(t) AS row FROM training_log.${table} t ORDER BY row_to_json(t)::text`);
      return [...rows, result.rows];
    }, Promise.resolve([]));
    const before = await snapshot();
    await migrate();
    await migrate();
    expect(await snapshot()).toEqual(before);
  });
});

test('rejects an older database without clearing existing data', async () => {
  await withMigrationDatabase(async (db, migrate) => {
    await db.query(`CREATE SCHEMA training_log; CREATE TABLE training_log.book (id integer); INSERT INTO training_log.book VALUES (42)`);
    await expect(migrate()).rejects.toThrow(/Existing database has no recognized migration history/);
    expect((await db.query('SELECT id FROM training_log.book')).rows).toEqual([{ id: 42 }]);
  });
});

test('serializes concurrent reading sessions so the same pages count only once', async ({ page, apiHeaders }) => {
  const id = randomUUID();
  await insertBook(id, 'Concurrent reading', 'Author', 200, new Date(), null, 0);
  const bootstrap = await page.request.get('/api/environment', { headers: apiHeaders });
  expect(bootstrap.ok()).toBeTruthy();
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')!;
  const headers = { ...apiHeaders, 'X-XSRF-TOKEN': csrf.value, 'X-Timezone': 'Europe/Budapest' };
  const responses = await Promise.all([1, 2].map(() => page.request.post(`/api/reading/books/${id}/progress`, {
    headers, data: { currentPage: 20, minutes: 10 },
  })));
  expect(responses.map(response => response.status()).sort()).toEqual([200, 400]);
  expect(await getReadingProgressRows()).toHaveLength(1);
});

test('OAuth authorization tickets reject mismatched state and callback replay', async ({ page, apiHeaders }) => {
  await query(`DELETE FROM training_log.oauth2_authorized_client WHERE client_registration_id = 'strava-client'`);
  const bootstrap = await page.request.get('/api/environment', { headers: apiHeaders });
  expect(bootstrap.ok()).toBeTruthy();
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN')!;
  const sync = await page.request.post('/api/strava/activities/sync', {
    headers: { ...apiHeaders, 'X-XSRF-TOKEN': csrf.value, 'X-Timezone': 'UTC' },
  });
  expect(sync.status()).toBe(401);
  const login = (await sync.json())._links.oauth2Login.href;
  const authorize = await page.request.get(login, { maxRedirects: 0 });
  const provider = new URL(authorize.headers().location);
  const callback = new URL(provider.searchParams.get('redirect_uri')!);
  callback.searchParams.set('code', 'test-code');
  callback.searchParams.set('state', 'wrong');
  expect((await page.request.get(callback.toString(), { maxRedirects: 0 })).status()).toBe(401);
  await page.goto(provider.toString());
  const validCallback = (await page.getByRole('link', { name: 'Authorize' }).getAttribute('href'))!;
  expect((await page.request.get(validCallback, { maxRedirects: 0 })).status()).toBe(303);
  expect((await page.request.get(validCallback, { maxRedirects: 0 })).status()).toBe(401);
});
