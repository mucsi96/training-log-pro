import { initializeFaro } from '@grafana/faro-web-sdk';

export function initFaro(clientLogUrl: string, clientAppName: string): void {
  if (!clientLogUrl) {
    return;
  }

  initializeFaro({
    url: clientLogUrl,
    app: {
      name: clientAppName,
      version: '1.0.0',
    },
    // Capture every console level so auth/token traces land in the backend logs.
    consoleInstrumentation: {
      disabledLevels: [],
    },
  });
}
