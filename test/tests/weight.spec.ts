import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, insertWeight } from '../utils';

test.describe('Weight', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await insertWeight(400, 108.9, 35.4, 38.6);
    await insertWeight(355, 98, 35.2, 34.5);
    await insertWeight(14, 89.4, 34.5, 30.8);
    await insertWeight(6, 88.3, 34.2, 30.2);
    await insertWeight(5, 87.7, 33.2, 29.1);
    await insertWeight(1, 87.5, 32.8, 29.0);
  });

  test('should display today\'s weight', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('87.2 kg')).toBeVisible();
    await expect(page.getByText('21.8 kg')).toBeVisible();
    await expect(page.getByText('35.3 %')).toBeVisible();
  });

  test('should display weight diff for week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 1.2 %')).toBeVisible();
    await expect(page.getByText('↓ 27.8 %')).toBeVisible();
    await expect(page.getByText('↑ 3.2 %')).toBeVisible();
  });

  test('should display weight chart for week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('88.3,');
    expect(label).toContain('87.7,');
    expect(label).toContain('87.5,');
    expect(label).toContain('87.2.');
    expect(label).not.toContain('108.9,');
    expect(label).not.toContain('98,');
    expect(label).not.toContain('89.4,');
  });

  test('should display weight chart for month', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Month' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('89.4,');
    expect(label).toContain('88.3,');
    expect(label).toContain('87.7,');
    expect(label).toContain('87.5,');
    expect(label).toContain('87.2.');
    expect(label).not.toContain('108.9,');
    expect(label).not.toContain('98,');
  });

  test('should display weight chart for year', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Year' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('98,');
    expect(label).toContain('89.4,');
    expect(label).toContain('88.3,');
    expect(label).toContain('87.7,');
    expect(label).toContain('87.5,');
    expect(label).toContain('87.2.');
    expect(label).not.toContain('108.9,');
  });

  test('should display weight diff for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 19.9 %')).toBeVisible();
    await expect(page.getByText('↓ 43.5 %')).toBeVisible();
    await expect(page.getByText('↓ 0.3 %')).toBeVisible();
  });

  test('should display weight chart for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('108.9,');
    expect(label).toContain('98,');
    expect(label).toContain('89.4,');
    expect(label).toContain('88.3,');
    expect(label).toContain('87.7,');
    expect(label).toContain('87.5,');
    expect(label).toContain('87.2.');
  });
});
