import { defineConfig } from '@playwright/test';

// Run against the test pod's database and mocks, with a separate JVM server so
// the fast cron cannot interfere with the ordinary browser suite.
export default defineConfig({
  testDir: './scheduled-sync',
  workers: 1,
  forbidOnly: !!process.env.CI,
  webServer: {
    command: 'node scheduled-sync/prepare.cjs && java -jar ../server/target/training-log-0.0.1-SNAPSHOT.jar --spring.profiles.active=test',
    url: 'http://localhost:8282/actuator/health',
    timeout: 120_000,
    env: {
      DB_URL: 'jdbc:postgresql://localhost:5480/test',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      SERVER_PORT: '8281',
      SPRING_ACTUATOR_PORT: '8282',
      DAILY_SYNC_CRON: '*/2 * * * * *',
      DAILY_SYNC_ZONE: 'Europe/Budapest',
      WITHINGS_API_URI: 'http://localhost:8180/withings',
      STRAVA_API_URI: 'http://localhost:8180/strava',
      SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_WITHINGS_TOKEN_URI: 'http://localhost:8180/withings/v2/oauth2',
      SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_STRAVA_TOKEN_URI: 'http://localhost:8180/strava/oauth/token',
    },
  },
});
