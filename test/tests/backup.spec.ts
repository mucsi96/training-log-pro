import { test, expect } from '../fixtures';

test.describe('Backup', () => {
  test('should display last backup time', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Last backup.*ago/ })).toBeVisible();
  });
});
