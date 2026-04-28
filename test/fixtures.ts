import { test as base, expect } from '@playwright/test';
import { cleanupDb, populateOAuthClients, resetStravaActivities } from './utils';

type ConsoleEntry = {
  timestamp: string;
  type: string;
  text: string;
  location?: string;
};

export const test = base.extend<{ forEachTest: void }>({
  forEachTest: [
    async ({ page }, use, testInfo) => {
      await cleanupDb();
      await populateOAuthClients();
      await resetStravaActivities();

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
