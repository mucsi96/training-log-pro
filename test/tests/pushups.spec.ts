import { test, expect } from '../fixtures';
import {
  cleanupDb,
  populateOAuthClients,
  insertPushupSet,
  getPushupSetRows,
  setGoals,
  setPushupSetSizes,
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

  test('adds a pushup set with the configured default size via the dial dialog', async ({ page }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Pushups' });

    await section.getByRole('button', { name: 'Add pushups' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add pushups' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('slider', { name: 'Pushup set count' })).toHaveAttribute(
      'aria-valuenow',
      '5'
    );

    await dialog.getByRole('button', { name: 'Add 5' }).click();

    await expect(dialog).toBeHidden();

    const rows = await getPushupSetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(5);
  });

  test('cancel closes the dialog without adding a set', async ({ page }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Pushups' });

    await section.getByRole('button', { name: 'Add pushups' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add pushups' });
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toBeHidden();

    const rows = await getPushupSetRows();
    expect(rows).toHaveLength(0);
  });

  test('dial uses configured default and max set sizes from settings', async ({ page }) => {
    await setPushupSetSizes(12, 40);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Pushups' });
    await section.getByRole('button', { name: 'Add pushups' }).click();

    const slider = page.getByRole('slider', { name: 'Pushup set count' });
    await expect(slider).toHaveAttribute('aria-valuenow', '12');
    await expect(slider).toHaveAttribute('aria-valuemax', '40');
  });

  test('chart includes daily totals across the period', async ({ page }) => {
    await insertPushupSet(daysAgoAt(2, 8), 30);
    await insertPushupSet(daysAgoAt(2, 18), 40);
    await insertPushupSet(daysAgoAt(0, 9), 25);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Pushups' });
    const chart = section.getByRole('img', { name: /chart/i });
    const label = await chart.getAttribute('aria-label');
    expect(label).toContain('70');
    expect(label).toContain('25');
  });

  test('reflects the configured golden day pushup goal in the chart mark line', async ({ page }) => {
    await setGoals(50, 250);
    await insertPushupSet(daysAgoAt(0, 8), 20);

    await page.goto('/');

    const section = page.getByRole('region', { name: 'Pushups' });
    await expect(section.getByRole('button', { name: 'Add pushups' })).toBeVisible();
  });
});
