import { test, expect } from '../fixtures';
import { cleanupDb, populateOAuthClients, insertWeight, setWithingsMeasures } from '../utils';

// Escape value into a regex; toHaveAttribute auto-retries, avoiding a one-shot read that races echarts clearing aria-label mid-redraw.
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
    await page.goto('/?view=health');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.locator('article', { has: page.getByRole('heading', { name: 'Weight', exact: true }) }).getByText('87.2 kg', { exact: true })).toBeVisible();
    await expect(page.getByText('21.8 kg')).toBeVisible();
    await expect(page.getByText('35.3 %')).toBeVisible();
  });

  test('should display today\'s diff inline with each value', async ({ page }) => {
    await page.goto('/?view=health');
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

  test('should display weight diff for the default month view', async ({ page }) => {
    await page.goto('/?view=health');
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 10.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 12.7 kg')).toBeVisible();
    await expect(page.getByText('↑ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for the default month view', async ({ page }) => {
    await page.goto('/?view=health');
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
    await expect(chart.getByText('98 kg', { exact: true })).toHaveCount(1);
    await expect(chart.getByText('87.2 kg', { exact: true })).toHaveCount(1);
    await expect(chart.getByText('88.3 kg', { exact: true })).toHaveCount(0);
  });

  test('should label the start, end and interior extremes on a narrow screen', async ({ page }) => {
    await insertWeight(4, 99, 33, 29);
    await insertWeight(3, 85, 33, 29);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/?view=health');
    const chart = page.locator('section:has-text("Weight") [role="img"]');
    for (const value of ['98 kg', '99 kg', '85 kg', '87.2 kg']) {
      await expect(chart.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(chart.getByText('87.7 kg', { exact: true })).toHaveCount(0);
  });

  test('should display weight diff for year', async ({ page }) => {
    await page.goto('/?view=health');
    await page.getByRole('combobox', { name: 'Range' }).click();
    await page.getByRole('option', { name: 'Year', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 21.7 kg')).toBeVisible();
    await expect(page.getByText('↓ 16.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for year', async ({ page }) => {
    await page.goto('/?view=health');
    await page.getByRole('combobox', { name: 'Range' }).click();
    await page.getByRole('option', { name: 'Year', exact: true }).click();
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
    await page.goto('/?view=health');
    await page.getByRole('combobox', { name: 'Range' }).click();
    await page.getByRole('option', { name: 'All time', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Weight' })).toBeVisible();
    await expect(page.getByText('↓ 21.7 kg')).toBeVisible();
    await expect(page.getByText('↓ 16.8 kg')).toBeVisible();
    await expect(page.getByText('↓ 0.1 %')).toBeVisible();
  });

  test('should display weight chart for all time', async ({ page }) => {
    await page.goto('/?view=health');
    await page.getByRole('combobox', { name: 'Range' }).click();
    await page.getByRole('option', { name: 'All time', exact: true }).click();
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
    await setWithingsMeasures([]);
    await insertWeight(14, 89.4, 34.5, 30.8);
    await insertWeight(6, 88.3, 34.2, 30.2);
    await insertWeight(5, 87.7, 33.2, 29.1);
    await insertWeight(2, 87.5, 32.8, 29.0);
  });

  test('should show the latest measurement and its date without a today diff', async ({ page }) => {
    await page.goto('/?view=health');
    const weight = page.locator('article', { has: page.getByRole('heading', { name: 'Weight', exact: true }) });
    await expect(weight.getByText('87.5 kg', { exact: true })).toBeVisible();
    await expect(weight.getByText(/Last measured/)).toBeVisible();
    await expect(weight.locator('.today-diff')).toHaveCount(0);
    await expect(page.getByText('29 kg', { exact: true })).toBeVisible();
    await expect(page.getByText('32.8 %', { exact: true })).toBeVisible();
  });

  test('should show the latest measurement even outside the selected period', async ({ page }) => {
    await cleanupDb();
    await populateOAuthClients();
    await insertWeight(60, 91.3, 33, 30);
    await page.goto('/?view=health');
    await expect(page.getByRole('heading', { name: 'Weight', exact: true })).toBeVisible();
    await expect(page.getByText('91.3 kg', { exact: true })).toBeVisible();
    await expect(page.getByText(/Last measured/)).toBeVisible();
  });

  test('should display weight chart even without today\'s measurement', async ({ page }) => {
    await page.goto('/?view=health');
    const chart = page.locator('section:has-text("Weight") [role="img"]').first();
    await expect(chart).toHaveAttribute('aria-label', /This is a chart with type Line chart/);
    await expect(chart).toHaveAttribute('aria-label', chartLabel('89.4,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('88.3,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.7,'));
    await expect(chart).toHaveAttribute('aria-label', chartLabel('87.5'));
  });
});
