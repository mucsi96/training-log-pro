import { defineConfig } from '@playwright/test';

// Run against the test pod's database and mocks, with a separate native server so
// the fast cron cannot interfere with the ordinary browser suite.
export default defineConfig({
  testDir: './scheduled-sync',
  workers: 1,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'node scheduled-sync/prepare.cjs && podman run --rm --network host -e LOCO_ENV -e DATABASE_URL -e PORT -e DAILY_SYNC_CRON -e DAILY_SYNC_ZONE -e WITHINGS_API_URL -e STRAVA_API_URL -e WITHINGS_TOKEN_URL -e STRAVA_TOKEN_URL localhost/training-log-pro-server:test',
    url: 'http://localhost:8281/healthz',
    timeout: 120_000,
    env: {
      LOCO_ENV: 'test',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5480/test',
      PORT: '8281',
      DAILY_SYNC_CRON: '*/2 * * * * *',
      DAILY_SYNC_ZONE: 'Europe/Budapest',
      WITHINGS_API_URL: 'http://localhost:8180/withings',
      STRAVA_API_URL: 'http://localhost:8180/strava',
      WITHINGS_TOKEN_URL: 'http://localhost:8180/withings/v2/oauth2',
      STRAVA_TOKEN_URL: 'http://localhost:8180/strava/oauth/token',
    },
  },
});
