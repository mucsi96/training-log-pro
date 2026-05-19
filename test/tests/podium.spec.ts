import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getSegmentEffortRows,
  insertSegmentEffort,
  populateOAuthClients,
  pushStravaActivity,
  setWithingsMeasures,
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

  test('skips segments with negative elevation when syncing', async ({ page }) => {
    await pushStravaActivity({
      segmentEfforts: [
        {
          id: 8001,
          segmentId: 81,
          segmentName: 'Uphill Climb',
          segmentDistance: 500,
          segmentAverageGrade: 5,
          elapsedTime: 120,
        },
        {
          id: 8002,
          segmentId: 82,
          segmentName: 'Downhill Descent',
          segmentDistance: 500,
          segmentAverageGrade: -5,
          elapsedTime: 80,
        },
      ],
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Calories' })).toBeVisible();

    const efforts = await getSegmentEffortRows();
    expect(efforts.map((row) => Number(row.id))).toEqual([8001]);
  });

  test('renders segment details and neighbour gaps on the podium panel', async ({
    page,
  }) => {
    // Strava sync triggers a Withings sync first, which persists today's
    // weight from the mock. Lock today's weight to 70 kg so watts/kg is
    // deterministic (280 W / 70 kg = 4.0 W/kg).
    await setWithingsMeasures([{ value: 700000, type: 1, unit: -4 }]);
    for (const [daysAgo, elapsed, effortId] of [
      [3, 200, 3001],
      [4, 220, 3002],
      [5, 260, 3003],
    ] as const) {
      await insertSegmentEffort({
        id: effortId,
        segmentId: 42,
        segmentName: 'UndAbflug',
        segmentDistance: 1200,
        segmentAverageGrade: 6,
        elapsedTime: elapsed,
        daysAgo,
        averageWatts: 240,
      });
    }

    await pushStravaActivity({
      segmentEfforts: [
        {
          id: 9101,
          segmentId: 42,
          segmentName: 'UndAbflug',
          segmentDistance: 1200,
          segmentAverageGrade: 6,
          elapsedTime: 210,
          averageWatts: 280,
        },
      ],
    });

    await page.goto('/');
    const panel = page.getByTestId('podium-banner');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('2nd place all-time on UndAbflug');
    await expect(panel).toHaveAttribute('data-position', '2');
    await expect(panel).toHaveAttribute('href', /\/segments\/42$/);
    await expect(panel).toHaveAttribute('target', '_blank');
    await expect(panel).toHaveAttribute('rel', /noopener/);

    await expect(page.getByTestId('podium-distance')).toContainText('1.2 km');
    await expect(page.getByTestId('podium-time')).toContainText('3:30');
    await expect(page.getByTestId('podium-elevation')).toContainText('72 m');
    await expect(page.getByTestId('podium-watts')).toContainText('280 W');
    await expect(page.getByTestId('podium-watts-per-kg')).toContainText('4.0 W/kg');
    await expect(page.getByTestId('podium-gap-faster')).toContainText('1st place');
    await expect(page.getByTestId('podium-gap-faster')).toContainText('-0:10');
    await expect(page.getByTestId('podium-gap-slower')).toContainText('3rd place');
    await expect(page.getByTestId('podium-gap-slower')).toContainText('+0:10');
  });
});
