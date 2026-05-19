import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  deleteOAuthClient,
  getOAuthClient,
  setWithingsMeasures,
  getWeightRows,
} from '../utils';

test.describe('Withings', () => {
  test('should authorize withings', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await deleteOAuthClient('withings-client');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mock Withings' })).toBeVisible();
    await page.getByRole('link', { name: 'Authorize' }).click();
    await page.waitForURL('/');

    const client = await getOAuthClient('withings-client');
    expect(client.principal_name).toBe('00000000-0000-0000-0000-000000000001');
  });

  test('should pull today\'s weight measurements from withings', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('87.2 kg')).toBeVisible();
    await expect(page.getByText('21.8 kg')).toBeVisible();
    await expect(page.getByText('35.3 %')).toBeVisible();
  });

  test('should not crash when withings returns no weight measurement', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await setWithingsMeasures([
      { value: 352664, type: 6, unit: -4 },
      { value: 217634, type: 8, unit: -4 },
    ]);

    const syncResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/withings/sync') && response.request().method() === 'POST'
    );
    await page.goto('/');
    const syncResponse = await syncResponsePromise;
    expect(syncResponse.status()).toBe(200);

    expect(await getWeightRows()).toEqual([]);
  });

  test('should persist weight when fat measurements are missing', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await setWithingsMeasures([
      { value: 871532, type: 1, unit: -4 },
    ]);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('87.2 kg')).toBeVisible();

    const rows = await getWeightRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].fat_ratio).toBeNull();
    expect(rows[0].fat_mass_weight).toBeNull();
  });
});
