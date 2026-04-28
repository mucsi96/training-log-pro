import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  insertPushupSet,
  getPushupSetRows,
} from '../utils';

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const daysAgoAt = (daysAgo: number, hour: number) => {
  const base = startOfTodayUtc();
  base.setUTCDate(base.getUTCDate() - daysAgo);
  base.setUTCHours(hour, 0, 0, 0);
  return base;
};

test.describe('Pushups', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test("shows today's progress toward the 100-pushup goal", async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 15);
    await insertPushupSet(daysAgoAt(0, 12), 20);

    await page.goto('/');

    const section = page.locator('section:has(#pushups-heading)');
    await expect(section.getByRole('heading', { name: 'Pushups' })).toBeVisible();
    await expect(section.getByText('35', { exact: true })).toBeVisible();
    await expect(section.getByText('/ 100')).toBeVisible();
    await expect(section.getByText('65 to go')).toBeVisible();
  });

  test('adds a pushup set via the +10 quick-add button', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section:has(#pushups-heading)');

    await section.getByRole('button', { name: 'Add 10 pushups' }).click();

    await expect(section.getByText('10', { exact: true })).toBeVisible();
    await expect(section.getByText('90 to go')).toBeVisible();
    await expect(section.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(section.locator('.set-list').getByText('+10')).toBeVisible();

    const rows = await getPushupSetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(10);
  });

  test('adds a pushup set via the custom input', async ({ page }) => {
    await page.goto('/');
    const section = page.locator('section:has(#pushups-heading)');

    const input = section.getByLabel('Custom pushup count');
    await input.fill('7');
    await section.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(section.getByText('7', { exact: true })).toBeVisible();
    await expect(section.getByText('93 to go')).toBeVisible();

    const rows = await getPushupSetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(7);
  });

  test('removes a logged set', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 9), 12);

    await page.goto('/');
    const section = page.locator('section:has(#pushups-heading)');

    await expect(section.getByText('12', { exact: true })).toBeVisible();
    await section.getByRole('button', { name: 'Remove set of 12 pushups' }).click();

    await expect(section.getByText('100 to go')).toBeVisible();
    expect(await getPushupSetRows()).toHaveLength(0);
  });

  test('shows daily-goal-reached state when total hits 100', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 50);
    await insertPushupSet(daysAgoAt(0, 14), 50);

    await page.goto('/');
    const section = page.locator('section:has(#pushups-heading)');

    await expect(section.getByText('100', { exact: true })).toBeVisible();
    await expect(section.getByText('Daily goal reached')).toBeVisible();
  });

  test('chart includes daily totals across the period', async ({ page }) => {
    await insertPushupSet(daysAgoAt(2, 8), 30);
    await insertPushupSet(daysAgoAt(2, 18), 40);
    await insertPushupSet(daysAgoAt(0, 9), 25);

    await page.goto('/');
    const section = page.locator('section:has(#pushups-heading)');
    const chart = section.locator('.chart-wrapper [role="img"]');
    await expect(chart).toHaveAttribute('aria-label', /chart/i);
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('70');
    expect(label).toContain('25');
  });
});
