import { faro, initializeFaro, LogLevel } from '@grafana/faro-web-sdk';

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
    // The "about to redirect to Entra" log fires synchronously right before
    // angular-auth-oidc-client reassigns window.location. Faro's default 250 ms
    // batch timer can miss that window, so collapse it - each log still batches
    // across the same synchronous tick, but the request flights before the
    // cross-origin navigation begins. Combined with FetchTransport's
    // keepalive: true default, the request survives the redirect.
    batching: {
      sendTimeout: 0,
    },
  });

  installFlushOnHide();
}

// Belt-and-suspenders flush on page lifecycle transitions. visibilitychange=hidden
// fires earlier and more reliably than pagehide on iOS PWA, so triggering a Faro
// API call here forces the batch to drain while the page is still alive.
function installFlushOnHide(): void {
  const flush = (reason: 'pagehide' | 'visibilitychange'): void => {
    faro?.api?.pushLog([`[faro] flush on ${reason}`], { level: LogLevel.INFO });
  };

  window.addEventListener('pagehide', () => flush('pagehide'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush('visibilitychange');
    }
  });
}
