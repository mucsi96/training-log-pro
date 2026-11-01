import { test, expect } from '../fixtures';

test('loads a deep link without storing OAuth credentials', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oidc.user:old-provider:old-client', '{"access_token":"old-token"}');
    sessionStorage.setItem('oidc.old-state', 'old-state');
    localStorage.setItem('training-preference', 'preserve');
  });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Open profile menu' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/settings');
  expect(await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
    .filter(key => key.startsWith('oidc.')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('training-preference'))).toBe('preserve');
});

test('an expired session during bootstrap returns to the original deep link', async ({ page }) => {
  await page.route('**/oauth2/start?*', route => route.fulfill({ contentType: 'text/html', body: 'Login' }));
  await page.route('**/api/environment', route => route.fulfill({ status: 401 }));
  await page.goto('/settings?tab=goals');
  await expect(page).toHaveURL(/\/oauth2\/start\?rd=%2Fsettings%3Ftab%3Dgoals$/);
});

test('expired gateway session redirects to login preserving the route', async ({ page }) => {
  await page.route('**/oauth2/start?*', route => route.fulfill({ contentType: 'text/html', body: 'Login' }));
  await page.route('**/oauth2/userinfo', route => route.fulfill({ status: 401 }));
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/oauth2\/start\?rd=%2Fsettings$/);
});

test('backend rejects unauthenticated requests and cookie-derived mutations without CSRF', async ({ request, apiHeaders }) => {
  expect((await request.get('/api/environment')).status()).toBe(401);
  expect((await request.post('/api/pushups', { headers: apiHeaders, data: { count: 10 } })).status()).toBe(403);
});
