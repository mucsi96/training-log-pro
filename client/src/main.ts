import { bootstrapApplication } from '@angular/platform-browser';
import { getAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { EnvironmentConfig } from './app/environment/environment.config';
import { initFaro } from './app/utils/faro';
import { haltForNavigation } from './app/utils/auth';

initFaro(new URL('/_telemetry/collect', window.location.origin).href, 'training-log-client');
loadEnvironmentConfig()
  .then(environment => bootstrapApplication(AppComponent, getAppConfig(environment)))
  .catch(error => console.error('[boot] Angular bootstrap failed', error));

async function loadEnvironmentConfig(): Promise<EnvironmentConfig> {
  const response = await fetch('/api/environment', { redirect: 'error' });
  if (response.status === 401) {
    const returnUrl = window.location.pathname + window.location.search + window.location.hash;
    window.location.assign(`/oauth2/start?rd=${encodeURIComponent(returnUrl)}`);
    return haltForNavigation();
  }
  if (!response.ok) throw new Error(`Failed to load config: ${response.status}`);
  return response.json();
}
