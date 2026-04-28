import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, deleteOAuthClient, getOAuthClient } from '../utils';

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
});
