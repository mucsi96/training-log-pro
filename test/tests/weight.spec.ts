import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, insertWeight } from '../utils';

// Build a regex that matches the literal value anywhere in the chart's
// aria-label. echarts redraws the SVG when the data changes, so the
// aria-label is briefly absent mid-render; asserting with toHaveAttribute
// (which auto-retries) avoids racing a one-shot getAttribute read.
const chartLabel = (value: string) =>
  new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

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

  test('should display today\'s diff inline with each value', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const weightArticle = page.locator('article', { hasText: 'Weight' });
    await expect(weightArticle.locator('.today-diff')).toHaveText('↓ 0.3 kg');
    await expect(weightArticle.locator('.today-diff')).toHaveClass(/green/);

    const fatArticle = page.locator('article', { hasText: 'Body fat' });
    await expect(fatArticle.locator('.today-diff')).toHaveText('↓ 7.2 kg');
    await expect(fatArticle.locator('.today-diff')).toHaveClass(/green/);

    const ratioArticle = page.locator('article', { hasText: 'Fat ratio' });
    await expect(ratioArticle.locator('.today-diff')).toHaveText('↑ 2.5 %');
    await expect(ratioArticle.locator('.today-diff')).toHaveClass(/red/);
  });

  test('should display weight diff for week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 2.2 kg')).toBeVisible();
    await expect(page.getByText('↓ 9.0 kg')).toBeVisible();
    await expect(page.getByText('↑ 0.8 %')).toBeVisible();
  });

  test('should display weight chart for week', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.2.'));
    await expect(chart).not.toHaveAttribute('aria-label', chartLabel('108.9,'));
    await expect(chart).not.toHaveAttribute('aria-label', chartLabel('98,'));
  });

  test('should display weight diff for month', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Month' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 10.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 12.7 kg')).toBeVisible();
    await expect(page.getByText('↑ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for month', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Month' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('98,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.2.'));
    await expect(chart).not.toHaveAttribute('aria-label', chartLabel('108.9,'));
  });

  test('should display weight diff for year', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Year' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 21.7 kg')).toBeVisible();
    await expect(page.getByText('↓ 16.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for year', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Year' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('108.9,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('98,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.2.'));
  });

  test('should display weight diff for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 21.7 kg')).toBeVisible();
    await expect(page.getByText('↓ 16.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for all time', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('108.9,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('98,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.2.'));
  });
});

test.describe('Weight without a measurement today', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await insertWeight(14, 89.4, 34.5, 30.8);
    await insertWeight(6, 88.3, 34.2, 30.2);
    await insertWeight(5, 87.7, 33.2, 29.1);
    await insertWeight(2, 87.5, 32.8, 29.0);
  });

  test('should display weight chart even without today\'s measurement', async ({ page }) => {
    await page.goto('/');
    const chart = page.locator('section:has-text("Weight") [role="img"]').first();
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5'));
  });
});
