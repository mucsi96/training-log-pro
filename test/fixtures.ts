import { test as base, expect } from '@playwright/test';
import { cleanupDb, populateOAuthClients, resetStravaActivities, resetWithingsMeasures } from './utils';

type ConsoleEntry = {
  timestamp: string;
  type: string;
  text: string;
  location?: string;
};

export const test = base.extend<{ forEachTest: void; apiHeaders: Record<string, string> }>({
  apiHeaders: async ({ request }, use) => {
    const issuer = 'http://localhost:8089/default';
    const redirect = 'http://localhost/test';
    const authorization = await request.get(`${issuer}/authorize`, {
      params: { client_id: 'test-client', redirect_uri: redirect, response_type: 'code' },
      maxRedirects: 0,
    });
    const code = new URL(authorization.headers()['location']).searchParams.get('code')!;
    const tokens = await request.post(`${issuer}/token`, {
      form: { grant_type: 'authorization_code', client_id: 'test-client', redirect_uri: redirect, code },
    });
    if (!tokens.ok()) throw new Error(`Mock token request failed: ${tokens.status()}`);
    await use({ Authorization: `Bearer ${(await tokens.json()).access_token}` });
  },
  forEachTest: [
    async ({ page, apiHeaders }, use, testInfo) => {
      await cleanupDb();
      await populateOAuthClients();
      await resetStravaActivities();
      await resetWithingsMeasures();

      // The app suite stands in for the gateway's validated session. Backend
      // JWT, scope/role and CSRF enforcement still run in the real server.
      await page.route('**/api/**', route => route.continue({ headers: { ...route.request().headers(), ...apiHeaders } }));
      await page.route('**/oauth2/userinfo', route => route.fulfill({ json: {
        email: 'test-user@example.com', additionalClaims: { name: 'Test User' },
      } }));
      await page.route('**/_telemetry/collect', route => route.fulfill({ status: 202, body: 'ok' }));

      const consoleLogs: ConsoleEntry[] = [];

      page.on('console', (msg) => {
        consoleLogs.push({
          timestamp: new Date().toISOString(),
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
            ? `${msg.location().url}:${msg.location().lineNumber}`
            : undefined,
        });
      });

      page.on('pageerror', (error) => {
        consoleLogs.push({
          timestamp: new Date().toISOString(),
          type: 'error',
          text: error.message,
        });
      });

      await use();

      if (testInfo.status !== testInfo.expectedStatus) {
        const logContent = consoleLogs
          .map(
            (entry) =>
              `[${entry.timestamp}] [${entry.type}] ${entry.text}${
                entry.location ? ` (${entry.location})` : ''
              }`
          )
          .join('\n');

        if (logContent) {
          const outputDir = testInfo.outputDir;
          const logPath = `${outputDir}/console-logs.txt`;
          const fs = await import('fs');
          fs.mkdirSync(outputDir, { recursive: true });
          fs.writeFileSync(logPath, logContent);
          await testInfo.attach('console-logs.txt', {
            path: logPath,
            contentType: 'text/plain',
          });
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
