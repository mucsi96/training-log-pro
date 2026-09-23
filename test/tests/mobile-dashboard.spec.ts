import { randomUUID } from 'crypto';
import { test, expect } from '../fixtures';
import { getDailyTaskCompletionRows, insertBook, insertDailyTask, insertPushupSet, insertReadingProgress, insertRide, insertSegmentEffort, pushStravaActivity } from '../utils';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

test('daily overview stays compact with a long task list', async ({ page }, testInfo) => {
  for (const name of ['Drink water', 'Morning stretch', 'Learn German', 'Water the plants', 'Take vitamins', 'Walk outside', 'Practice piano', 'Plan tomorrow', 'Tidy the kitchen', 'Evening stretch', 'Journal', 'Floss']) {
    await insertDailyTask(randomUUID(), name);
  }
  const bookId = randomUUID();
  await insertBook(bookId, 'Atomic Habits', 'James Clear', 320);
  await insertReadingProgress(bookId, 124, new Date());
  await insertPushupSet(new Date(), 40);
  await insertRide(0, 420, 18500, 2700, 'Morning ride', 'Ride', 180, 190);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Daily tasks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atomic Habits, 124 of 320 pages' })).toBeVisible();
  const tasks = page.getByRole('region', { name: 'Daily tasks' });
  await expect(tasks.getByRole('checkbox')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Add pushups' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Atomic Habits, 124 of 320 pages' })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath('iphone-overview.png'), fullPage: true });

  const reading = page.getByRole('article', { name: 'Atomic Habits', exact: true });
  await expect(reading).toBeInViewport({ ratio: 1 });
  await expect(reading.getByText('pages/day', { exact: true })).not.toBeVisible();
  await reading.getByText('Reading details', { exact: true }).click();
  await expect(reading.getByText('pages/day', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('iphone-reading-expanded.png'), fullPage: true });
  await reading.getByText('Reading details', { exact: true }).click();
  await expect(reading.getByText('pages/day', { exact: true })).not.toBeVisible();

  await tasks.getByRole('button', { name: 'View all 12 tasks' }).click();
  await expect(tasks.getByRole('checkbox')).toHaveCount(12);
  await tasks.getByRole('checkbox', { name: 'Floss', exact: true }).check();
  await expect(tasks.getByText('1 / 12 done')).toBeVisible();
  expect(await getDailyTaskCompletionRows()).toHaveLength(1);
  await tasks.getByRole('button', { name: 'Show fewer tasks' }).click();
  await expect(tasks.getByRole('checkbox')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add pushups' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('tab', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Calories', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('iphone-training.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Range' }).click();
  await page.getByRole('option', { name: 'Year', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Training', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Range' })).toHaveText('Year');
  await expect(page.getByRole('tab', { name: 'Training', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Health', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Weight', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reading', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('iphone-health.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await tasks.getByRole('button', { name: 'View all 12 tasks' }).click();
  await expect(tasks.getByRole('checkbox', { name: 'Floss', exact: true })).toBeChecked();
  await tasks.getByRole('button', { name: 'Show fewer tasks' }).click();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole('button', { name: 'Add pushups' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: testInfo.outputPath('iphone-se-overview.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('desktop-overview.png'), fullPage: true });
});

test('ride achievement reveals details only when requested', async ({ page }, testInfo) => {
  for (const daysAgo of [1, 2, 3]) {
    await insertSegmentEffort({ id: daysAgo, segmentId: 100, segmentName: 'Morning climb', segmentDistance: 1200, segmentAverageGrade: 6, elapsedTime: 240, daysAgo, averageWatts: 220 });
  }
  await pushStravaActivity({ segmentEfforts: [{ id: 10, segmentId: 100, segmentName: 'Morning climb', segmentDistance: 1200, segmentAverageGrade: 6, elapsedTime: 210, averageWatts: 220 }] });
  await page.goto('/?view=training');
  const podium = page.getByTestId('podium-banner');
  await expect(podium).toBeVisible();
  await expect(page.getByTestId('podium-distance')).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('iphone-podium-collapsed.png'), fullPage: true });
  await podium.getByText('Segment details & route', { exact: true }).click();
  await expect(page.getByTestId('podium-distance')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('iphone-podium-expanded.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
