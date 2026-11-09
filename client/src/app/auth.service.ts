import { Injectable, signal } from '@angular/core';
import { flushFaro } from './utils/faro';

/** OAuth credentials belong to the gateway; the browser only reads display data. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(false);
  readonly userData = signal<{ name?: string; preferred_username?: string } | null>(null);
  private redirectInProgress = false;

  async init(): Promise<void> {
    // Remove credentials left by the former browser OIDC client.
    for (const storage of [localStorage, sessionStorage]) {
      Object.keys(storage).filter(key => key.startsWith('oidc.')).forEach(key => storage.removeItem(key));
    }
    const response = await fetch('/oauth2/userinfo', { redirect: 'error' });
    if (response.status === 401) {
      this.login();
      return;
    }
    if (!response.ok) throw new Error(`Session lookup failed: ${response.status}`);
    const profile = await response.json();
    this.userData.set({ name: profile.additionalClaims?.name, preferred_username: profile.email });
    this.isAuthenticated.set(true);
  }

  login(): void {
    if (this.redirectInProgress) return;
    this.redirectInProgress = true;
    const returnUrl = window.location.pathname + window.location.search + window.location.hash;
    void flushFaro().finally(() => window.location.assign(`/oauth2/start?rd=${encodeURIComponent(returnUrl)}`));
  }

  logout(): void {
    void flushFaro().finally(() => window.location.assign('/oauth2/sign_out'));
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    this.login();
    return false;
  }
}
