import { test, expect } from '../fixtures';
import {
  cleanupDb,
  getScheduleRows,
  populateOAuthClients,
  setExtractedMeetings,
  setSchedulePlan,
  setScheduleSettings,
  setWeatherForecast,
} from '../utils';

// 1x1 transparent PNG — the mock Anthropic server ignores the image bytes and
// returns the canned meetings, so any valid image works here.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const planBlocks = [
  { startTime: '08:00', endTime: '08:20', title: 'Commute to office', type: 'commute' },
  { startTime: '10:00', endTime: '11:00', title: 'Sprint planning', type: 'meeting' },
  { startTime: '11:15', endTime: '11:40', title: 'Focus work', type: 'pomodoro' },
  { startTime: '15:30', endTime: '16:15', title: 'Pick up son from school', type: 'school-pickup' },
  { startTime: '18:00', endTime: '19:00', title: 'Evening training ride', type: 'training-ride' },
];

async function configureSchedule() {
  await setScheduleSettings({
    homeLat: 47.5,
    homeLng: 19.05,
    officeAddress: '1 Office Street',
    schoolAddress: '2 School Lane',
    workStartTime: '09:00',
    workEndTime: '17:00',
    sonPickupTime: '16:00',
    commuteBikeMinutes: 30,
    commuteCarMinutes: 20,
    rainThresholdMm: 1,
    pomodoroMinutes: 25,
    trainingRideMinutes: 60,
    germanCardsMinutes: 20,
    readingMinutes: 30,
    germanWithWifeMinutes: 30,
    flashcardCreationMinutes: 20,
  });
  await setExtractedMeetings([
    { title: 'Sprint planning', startTime: '10:00', endTime: '11:00', location: 'Room A' },
  ]);
  await setSchedulePlan(planBlocks);
}

async function uploadAndReview(page: import('@playwright/test').Page) {
  await page.goto('/schedule');
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'calendar.png', mimeType: 'image/png', buffer: PNG_BUFFER });

  await expect(page.getByRole('heading', { name: 'Review meetings' })).toBeVisible();
  await expect(page.getByText('Sprint planning')).toBeVisible();

  // Mark the meeting as requiring the office so a commute is planned.
  await page.getByRole('switch', { name: 'At office' }).click();
  await page.getByRole('button', { name: 'Generate schedule' }).click();
}

test.describe('Daily schedule planner', () => {
  test.beforeEach(async () => {
    await cleanupDb();
    await populateOAuthClients();
    await configureSchedule();
  });

  test('plans a car commute and keeps the training ride when it rains', async ({ page }) => {
    await setWeatherForecast(5); // 5mm > 1mm threshold -> car

    await uploadAndReview(page);

    await expect(page.getByText(/by car/)).toBeVisible();
    await expect(page.getByText('Focus work')).toBeVisible();
    await expect(page.getByText('Pick up son from school')).toBeVisible();
    await expect(page.getByText('Evening training ride')).toBeVisible();

    const rows = await getScheduleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].commute_mode).toBe('car');
  });

  test('plans a bike commute and drops the training ride when it is dry', async ({ page }) => {
    await setWeatherForecast(0); // dry -> bike

    await uploadAndReview(page);

    await expect(page.getByText(/by bike/)).toBeVisible();
    await expect(page.getByText('Focus work')).toBeVisible();
    // A training ride is not planned when commuting home by bike.
    await expect(page.getByText('Evening training ride')).toHaveCount(0);

    const rows = await getScheduleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].commute_mode).toBe('bike');
    expect(JSON.stringify(rows[0].blocks)).not.toContain('training-ride');
  });
});
