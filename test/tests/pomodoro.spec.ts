import { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

type NotificationEvent = {
  type: 'permission' | 'shown' | 'closed';
  title?: string;
  body?: string;
};

// The OS notification surface is outside Playwright; exercise the browser API boundary.
const mockNotifications = async (
  page: Page,
  permission: NotificationPermission = 'denied',
  failure: 'permission' | 'delivery' | null = null
) => {
  const events: NotificationEvent[] = [];
  await page.exposeFunction('recordNotification', (event: NotificationEvent) => events.push(event));
  await page.addInitScript(({ permission, failure }) => {
    const record = (event: NotificationEvent) =>
      (window as unknown as { recordNotification: (event: NotificationEvent) => void }).recordNotification(event);

    class TestNotification {
      static permission = permission;
      onclick?: () => void;

      static async requestPermission() {
        record({ type: 'permission' });
        if (failure === 'permission') {
          throw new Error('Notification permission unavailable');
        }
        this.permission = 'granted';
        return this.permission;
      }

      constructor(title: string, options: NotificationOptions) {
        if (failure === 'delivery') {
          throw new Error('Notification delivery unavailable');
        }
        record({ type: 'shown', title, body: options.body });
        window.addEventListener('test-notification-click', () => this.onclick?.(), { once: true });
      }

      close() {
        record({ type: 'closed' });
      }
    }

    Object.defineProperty(window, 'Notification', { value: TestNotification, configurable: true });
  }, { permission, failure });
  return events;
};

const openTimer = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Pomodoro' })).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
};

const startTimer = async (page: Page) => {
  await page.getByRole('button', { name: 'Start Pomodoro' }).click();
  // Allow Angular's scheduled render while keeping the countdown clock controlled.
  await page.clock.runFor(20);
};

const favicon = (page: Page) => page.locator('link[rel="icon"]');
const faviconSvg = async (page: Page) =>
  decodeURIComponent((await favicon(page).getAttribute('href'))!.split(',')[1]);

test('starts with one click and keeps the countdown and donut in sync across navigation', async ({ page }) => {
  await mockNotifications(page);
  await openTimer(page);
  await startTimer(page);

  await expect(page.getByRole('timer', { name: 'Pomodoro time remaining' })).toHaveText('25:00');
  await expect(page).toHaveTitle('25:00 · Tracker');
  await expect(favicon(page)).toHaveAttribute('type', 'image/svg+xml');
  expect(await faviconSvg(page)).toContain('stroke-dasharray="100 100"');
  expect(await faviconSvg(page)).toContain('#66bb6a');
  // Check that the generated favicon is an image the browser can actually decode.
  await favicon(page).evaluate(async (link: HTMLLinkElement) => {
    const image = new Image();
    image.src = link.href;
    await image.decode();
  });

  await page.clock.runFor(1000);
  await expect(page).toHaveTitle('24:59 · Tracker');

  await page.getByRole('button', { name: 'Open profile menu' }).click();
  await page.clock.runFor(200);
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.clock.runFor(200);
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('timer')).toHaveText('24:59');

  await page.clock.fastForward(749_000);
  await expect(page.getByRole('timer')).toHaveText('12:30');
  await expect(page).toHaveTitle('12:30 · Tracker');
  expect(await faviconSvg(page)).toContain('stroke-dasharray="50 100"');
  expect(await faviconSvg(page)).toContain('#ffa726');

  await page.clock.fastForward(450_000);
  await expect(page).toHaveTitle('05:00 · Tracker');
  expect(await faviconSvg(page)).toContain('stroke-dasharray="20 100"');
  expect(await faviconSvg(page)).toContain('#ef5350');
});

test('cancels, restores the tab, and starts a fresh 25-minute session', async ({ page }) => {
  const events = await mockNotifications(page, 'granted');
  await openTimer(page);
  const originalIcon = await favicon(page).getAttribute('href');
  await startTimer(page);
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: 'Cancel Pomodoro' }).click();

  await expect(page).toHaveTitle('Tracker');
  await expect(favicon(page)).toHaveAttribute('href', new URL(originalIcon!, page.url()).href);
  await expect(favicon(page)).toHaveAttribute('type', 'image/png');
  await page.clock.fastForward(25 * 60_000);
  await expect(page).toHaveTitle('Tracker');
  expect(events).toEqual([]);

  await startTimer(page);
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page).toHaveTitle('25:00 · Tracker');
});

test('flashes the title and favicon on completion until dismissed when notifications are denied', async ({ page }) => {
  const events = await mockNotifications(page);
  await openTimer(page);
  await startTimer(page);
  await page.clock.fastForward(25 * 60_000);

  await expect(page.getByRole('status').filter({ hasText: 'Focus session complete' })).toBeVisible();
  await expect(page).toHaveTitle("Time's up! · Tracker");
  const alertIcon = await favicon(page).getAttribute('href');
  await page.clock.runFor(1000);
  await expect(page).toHaveTitle('00:00 · Tracker');
  expect(await favicon(page).getAttribute('href')).not.toBe(alertIcon);
  await page.clock.runFor(1000);
  await expect(page).toHaveTitle("Time's up! · Tracker");
  await expect(favicon(page)).toHaveAttribute('href', alertIcon!);
  expect(events).toEqual([]);

  await page.getByRole('button', { name: 'Dismiss Pomodoro' }).click();
  await page.clock.runFor(2000);
  await expect(page).toHaveTitle('Tracker');
  await expect(page.getByRole('button', { name: 'Start Pomodoro' })).toBeVisible();
});

test('catches up after sleep and sends one notification that can dismiss the alert', async ({ page }) => {
  const events = await mockNotifications(page, 'default');
  await openTimer(page);
  expect(events).toEqual([]);
  await startTimer(page);
  await expect.poll(() => events.filter((event) => event.type === 'permission')).toHaveLength(1);

  // Simulate sleep: the wall clock advances without any interval callbacks.
  await page.clock.setSystemTime(new Date(Date.now() + 30 * 60_000));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page).toHaveTitle("Time's up! · Tracker");
  await expect.poll(() => events.filter((event) => event.type === 'shown')).toEqual([{
    type: 'shown',
    title: 'Pomodoro complete',
    body: 'Your 25-minute focus session is over. Time for a break!',
  }]);
  await page.clock.runFor(5000);
  expect(events.filter((event) => event.type === 'shown')).toHaveLength(1);

  await page.evaluate(() => window.dispatchEvent(new Event('test-notification-click')));
  await page.clock.runFor(20);
  await expect(page.getByRole('button', { name: 'Start Pomodoro' })).toBeVisible();
  await expect(page).toHaveTitle('Tracker');
  await expect.poll(() => events.filter((event) => event.type === 'closed')).toHaveLength(1);
});

test('works when the browser does not support notifications', async ({ page }) => {
  await page.addInitScript(() => Reflect.deleteProperty(window, 'Notification'));
  await openTimer(page);
  await startTimer(page);
  await page.clock.fastForward(25 * 60_000);
  await expect(page.getByRole('button', { name: 'Dismiss Pomodoro' })).toBeVisible();
  await expect(page).toHaveTitle("Time's up! · Tracker");
});

for (const failure of ['permission', 'delivery'] as const) {
  test(`keeps the timer and tab alert working after notification ${failure} fails`, async ({ page }) => {
    await mockNotifications(page, failure === 'permission' ? 'default' : 'granted', failure);
    await openTimer(page);
    await startTimer(page);
    await expect(page).toHaveTitle('25:00 · Tracker');
    await page.clock.fastForward(25 * 60_000);
    await expect(page).toHaveTitle("Time's up! · Tracker");
    await page.clock.runFor(1000);
    await expect(page).toHaveTitle('00:00 · Tracker');
    await expect(page.getByRole('button', { name: 'Dismiss Pomodoro' })).toBeVisible();
  });
}

test('keeps the desktop-only control out of the mobile header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open profile menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Pomodoro' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
