import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getWeekPlanRows,
  insertActivity,
  insertLocation,
  populateOAuthClients,
  setExtractedMeetings,
  setPlanningSettings,
  setSchedulePlan,
  setWeatherForecast,
} from '../utils';

// 1x1 transparent PNG — the mock Anthropic server ignores the image bytes and
// returns the canned meetings, so any valid image works here.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Local calendar date (matches the server's X-Timezone-based "today").
function localIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const today = localIso();

async function configurePlanning() {
  await setPlanningSettings({
    workStartTime: '09:00',
    workEndTime: '17:00',
    rainThresholdMm: 1,
  });
  const home = await insertLocation({
    name: 'Home',
    home: true,
    latitude: 47.5,
    longitude: 19.05,
  });
  await insertLocation({
    name: 'Office',
    address: '1 Office Street',
    bikeMinutesFromHome: 30,
    carMinutesFromHome: 20,
  });
  await insertActivity({
    name: 'Evening training ride',
    durationMinutes: 60,
    occurrencesPerWeek: 2,
    constraintNote: "Only on days I don't cycle home from the office",
  });
  return home;
}

async function seedAiForToday() {
  await setExtractedMeetings([
    { date: today, title: 'Sprint planning', startTime: '10:00', endTime: '11:00', location: 'Room A' },
  ]);
  await setSchedulePlan([
    {
      date: today,
      blocks: [
        { startTime: '08:00', endTime: '08:20', title: 'Commute to office', type: 'commute' },
        { startTime: '11:15', endTime: '11:40', title: 'Focus work', type: 'pomodoro' },
      ],
    },
  ]);
}

async function reviewAndGenerate(page: import('@playwright/test').Page) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'calendar.png', mimeType: 'image/png', buffer: PNG_BUFFER });

  await expect(page.getByRole('heading', { name: 'Review meetings' })).toBeVisible();
  await expect(page.getByText('Sprint planning')).toBeVisible();

  await page.getByRole('switch', { name: 'At office' }).click();
  await page.getByRole('button', { name: 'Generate week' }).click();
}

async function uploadReviewGenerate(page: import('@playwright/test').Page) {
  await page.goto('/schedule');
  await reviewAndGenerate(page);
}

test.describe('Weekly schedule planner', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await configurePlanning();
    await seedAiForToday();
  });

  test('plans the week with a car commute when it rains on an office day', async ({ page }) => {
    await setWeatherForecast(5); // 5mm > 1mm threshold -> car

    await uploadReviewGenerate(page);

    await expect(page.getByText('Focus work')).toBeVisible();
    await expect(page.getByText(/car/)).toBeVisible();

    const rows = await getWeekPlanRows();
    expect(rows).toHaveLength(1);
    const day = rows[0].days.find((d: { date: string }) => d.date === today);
    expect(day.commuteMode).toBe('car');
  });

  test('replans the week by uploading a new calendar photo', async ({ page }) => {
    await setWeatherForecast(5);

    await uploadReviewGenerate(page);
    await expect(page.getByText('Focus work')).toBeVisible();

    // Replanning updates the stored week instead of creating a second one.
    await page.getByRole('button', { name: 'Upload new calendar / replan' }).click();
    await reviewAndGenerate(page);

    await expect(page.getByText('Focus work')).toBeVisible();
    const rows = await getWeekPlanRows();
    expect(rows).toHaveLength(1);
  });

  test('plans the week with a bike commute when it is dry on an office day', async ({ page }) => {
    await setWeatherForecast(0); // dry -> bike

    await uploadReviewGenerate(page);

    await expect(page.getByText('Focus work')).toBeVisible();
    await expect(page.getByText(/bike/)).toBeVisible();

    const rows = await getWeekPlanRows();
    expect(rows).toHaveLength(1);
    const day = rows[0].days.find((d: { date: string }) => d.date === today);
    expect(day.commuteMode).toBe('bike');
  });
});
