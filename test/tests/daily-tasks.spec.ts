import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getDailyTaskCompletionRows,
  getDailyTaskRows,
  getGoldenDayDates,
  insertDailyTask,
  insertPushupSet,
  insertRide,
  populateOAuthClients,
  setGoals,
} from '../utils';
import { randomUUID } from 'crypto';

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

const isoDate = (daysAgo: number) => {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const insertGoldenRide = (daysAgo: number, totalElevationGain: number) =>
  insertRide(
    daysAgo,
    400,
    20000,
    3600,
    `Ride d-${daysAgo}`,
    'Ride',
    totalElevationGain,
    180
  );

test.describe('Daily tasks', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('adds a task from settings and shows it on the home checklist', async ({ page }) => {
    await page.goto('/settings');

    const library = page.getByRole('region', { name: 'Daily tasks' });
    await expect(library.getByText('No tasks yet. Add things you want to do every day.')).toBeVisible();

    await library.getByRole('button', { name: 'Add task' }).click();
    await library.getByLabel('Task name').fill('Learn German');
    await library.getByRole('button', { name: 'Add task' }).click();

    await expect(library.getByText('Learn German')).toBeVisible();

    const rows = await getDailyTaskRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Learn German');

    await page.goto('/');
    const checklist = page.getByRole('region', { name: 'Daily tasks' });
    await expect(checklist.getByRole('checkbox', { name: 'Learn German' })).toBeVisible();
  });

  test('toggles task completion from the home checklist and persists in DB', async ({ page }) => {
    const taskId = randomUUID();
    await insertDailyTask(taskId, 'Water flower');

    await page.goto('/');
    const checklist = page.getByRole('region', { name: 'Daily tasks' });
    const checkbox = checklist.getByRole('checkbox', { name: 'Water flower' });
    await expect(checkbox).not.toBeChecked();

    await checkbox.check();

    await expect(checklist.getByText('1 / 1 done')).toBeVisible();
    let completions = await getDailyTaskCompletionRows();
    expect(completions).toHaveLength(1);
    expect(completions[0].task_id).toBe(taskId);
    expect(completions[0].date).toBe(isoDate(0));

    await checkbox.uncheck();
    await expect(checklist.getByText('0 / 1 done')).toBeVisible();
    completions = await getDailyTaskCompletionRows();
    expect(completions).toHaveLength(0);
  });

  test('renames a task in settings and reflects it on the home checklist', async ({ page }) => {
    const taskId = randomUUID();
    await insertDailyTask(taskId, 'Learn German');

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Daily tasks' });
    await library.getByRole('button', { name: 'Edit Learn German' }).click();
    await library.getByLabel('Task name').fill('Learn German vocab');
    await library.getByRole('button', { name: 'Save task' }).click();

    await expect(library.getByText('Learn German vocab')).toBeVisible();

    await page.goto('/');
    const checklist = page.getByRole('region', { name: 'Daily tasks' });
    await expect(
      checklist.getByRole('checkbox', { name: 'Learn German vocab' })
    ).toBeVisible();
  });

  test('deletes a task in settings and removes it from the home checklist', async ({ page }) => {
    const taskId = randomUUID();
    await insertDailyTask(taskId, 'Read German book');

    await page.goto('/settings');
    const library = page.getByRole('region', { name: 'Daily tasks' });
    await library.getByRole('button', { name: 'Remove Read German book' }).click();

    await expect(library.getByText('No tasks yet. Add things you want to do every day.')).toBeVisible();
    expect(await getDailyTaskRows()).toHaveLength(0);

    await page.goto('/');
    const checklist = page.getByRole('region', { name: 'Daily tasks' });
    await expect(checklist).toBeHidden();
  });

  test('hides daily tasks card on home when no tasks exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Daily tasks' })).toBeHidden();
  });

  test('gates golden day on daily task goal when configured', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 260);
    await insertDailyTask(randomUUID(), 'Learn German');
    await insertDailyTask(randomUUID(), 'Water flower');
    await setGoals(100, 250, 0, 2);

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('0/2 tasks')).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeHidden();

    const checklist = page.getByRole('region', { name: 'Daily tasks' });
    await checklist.getByRole('checkbox', { name: 'Learn German' }).check();
    await expect(section.getByText('1/2 tasks')).toBeVisible();
    await expect(section.getByText('Today is golden')).toBeHidden();

    await checklist.getByRole('checkbox', { name: 'Water flower' }).check();
    await expect(section.getByText('Today is golden')).toBeVisible();
    expect(await getGoldenDayDates()).toContain(isoDate(0));
  });

  test('ignores daily tasks when goal is zero', async ({ page }) => {
    await insertPushupSet(daysAgoAt(0, 8), 100);
    await insertGoldenRide(0, 260);
    await insertDailyTask(randomUUID(), 'Learn German');

    await page.goto('/');
    const section = page.getByRole('region', { name: 'Golden day' });
    await expect(section.getByText('Today is golden')).toBeVisible();
    await expect(section.getByText(/tasks$/)).toBeHidden();
  });
});
