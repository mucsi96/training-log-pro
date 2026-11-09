# Daily sync

The server syncs connected Withings and Strava accounts every day at **21:00
Europe/Budapest**, including daylight-saving adjustments. No browser session is
needed. Accounts must have been authorized once; saved encrypted refresh tokens
allow the job to renew expired access tokens.

Weight is synced before Strava, which also updates segments, segment efforts,
fitness and FTP. The scheduled and browser-triggered syncs share the same logic.
Failures are logged per account and do not stop other accounts from syncing.
Revoked authorization needs reconnection through the app.

Configuration:

- `DAILY_SYNC_CRON`: Spring six-field cron; defaults to `0 0 21 * * *`.
  Set to `-` to disable scheduling.
- `DAILY_SYNC_ZONE`: defaults to `Europe/Budapest`; also determines the day
  boundaries used to fetch measurements and activities.

The server must be running at the scheduled time. This fetches today's data as
of 9 PM; it does not backfill missed runs or fetch activities recorded afterward.

## Verification

With the test pod running, build the JVM server and run the dedicated Playwright
suite (from the repository root):

```bash
mvn -f server/pom.xml package -DskipTests
npm --prefix test exec -- playwright test --config test/playwright.scheduled-sync.config.ts
```

The suite starts a separate test-profile server on ports 8281/8282 with a two-second
cron, using the pod's database and mock APIs. Run it separately from the normal
browser suite because both use the same database. It verifies background sync,
encrypted token refresh, derived metrics, repeat-sync idempotency, and isolation
of integration failures without opening the app.
