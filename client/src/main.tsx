import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { NotificationsProvider } from '@mucsi96/react-ui';
import { BrowserRouter } from 'react-router-dom';
import { initializeFaro } from '@grafana/faro-web-sdk';
import '@mucsi96/react-ui/styles.css';
import './styles.css';
import { queryClient } from './api';
import { App } from './App';

for (const storage of [localStorage, sessionStorage]) {
  Object.keys(storage)
    .filter((key) => key.startsWith('oidc.') || key.startsWith('msal.'))
    .forEach((key) => storage.removeItem(key));
}
initializeFaro({
  url: new URL('/_telemetry/collect', location.origin).href,
  app: { name: 'training-log-client', version: '1.0.0' },
  consoleInstrumentation: { disabledLevels: [] },
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NotificationsProvider>
    </QueryClientProvider>
  </StrictMode>
);
