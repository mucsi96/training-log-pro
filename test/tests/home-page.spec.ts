import { test, expect } from '@playwright/test';

test('should display the app title', async ({ page }) => {
  await page.goto('http://localhost:8180');

  await expect(page.getByRole('link', { name: 'Training Log Pro' })).toBeVisible();
});

test('should display weight data', async ({ page }) => {
  await page.goto('http://localhost:8180');

  await expect(page.getByRole('heading', { name: /weight/i })).toBeVisible();
});
