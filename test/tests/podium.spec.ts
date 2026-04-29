import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getSegmentEffortRows,
  insertSegmentEffort,
  populateOAuthClients,
  pushStravaActivity,
} from '../utils';

test.describe('Podium messages', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
  });

  test('shows the best podium message above ride stats', async ({ page }) => {
    // Two segments: one easy (Flat Loop), one hard (Steep Hill)
    // Three historical efforts on each so the user has a "podium" to enter.
    // Today's effort on Steep Hill is the new fastest of the week, which
    // should outrank a 1st place all-time on the easier Flat Loop because
    // Steep Hill is harder.
    for (const daysAgo of [3, 4, 5]) {
      await insertSegmentEffort({
        id: 1000 + daysAgo,
        segmentId: 1,
        segmentName: 'Flat Loop',
        segmentDistance: 1000,
        segmentAverageGrade: 1,
        elapsedTime: 200,
        daysAgo,
      });
      await insertSegmentEffort({
        id: 2000 + daysAgo,
        segmentId: 2,
        segmentName: 'Steep Hill',
        segmentDistance: 800,
        segmentAverageGrade: 10,
        elapsedTime: 300,
        daysAgo,
      });
    }

    // Today's ride: a fastest-ever on Flat Loop AND a fastest-of-week on Steep Hill.
    await pushStravaActivity({
      segmentEfforts: [
        {
          id: 9001,
          segmentId: 1,
          segmentName: 'Flat Loop',
          segmentDistance: 1000,
          segmentAverageGrade: 1,
          elapsedTime: 100,
        },
        {
          id: 9002,
          segmentId: 2,
          segmentName: 'Steep Hill',
          segmentDistance: 800,
          segmentAverageGrade: 10,
          elapsedTime: 250,
        },
      ],
    });

    await page.goto('/');

    // Sync persisted both segment efforts from the synced activity.
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    const efforts = await getSegmentEffortRows();
    expect(efforts.map((row) => Number(row.id))).toEqual(
      expect.arrayContaining([9001, 9002])
    );

    // The harder Steep Hill effort wins the single banner, even though
    // the Flat Loop effort earned a higher (1st all-time) placement.
    const banner = page.getByTestId('podium-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Steep Hill');
    await expect(banner).not.toContainText('Flat Loop');
  });

  test('shows nothing when no podium was reached today', async ({ page }) => {
    await pushStravaActivity({ segmentEfforts: [] });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(page.getByTestId('podium-banner')).toHaveCount(0);
  });
});
