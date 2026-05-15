import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';
import { haltForNavigation } from '../utils/auth';

const REDIRECT_GUARD_KEY = 'withings-authorize-redirected';

@Injectable({ providedIn: 'root' })
export class WithingsService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private syncPromise: Promise<void> | undefined;
  private readonly _isSynced = signal(false);
  readonly isSynced = this._isSynced.asReadonly();

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = (async () => {
        try {
          await fetchJson<void>(this.http, '/api/withings/sync', {
            method: 'post',
          });
          // Reset the guard on success so a later 401 can redirect once again.
          sessionStorage.removeItem(REDIRECT_GUARD_KEY);
        } catch (error) {
          const httpError = error as HttpErrorResponse;
          const authorizeUrl = httpError.error?._links?.oauth2Login?.href;
          if (httpError.status === 401 && authorizeUrl) {
            if (sessionStorage.getItem(REDIRECT_GUARD_KEY)) {
              this.notifications.error(
                'Unable to authorize Withings. Please try again later.',
                { duration: 5000 }
              );
            } else {
              sessionStorage.setItem(REDIRECT_GUARD_KEY, '1');
              window.location.href = authorizeUrl;
              // Keep this promise pending so StravaService (which awaits
              // this.withingsService.sync()) does not proceed to make its own
              // API call and trigger a competing redirect.
              await haltForNavigation();
            }
          } else {
            this.notifications.error('Unable to sync with Withings');
          }
        }
        this._isSynced.set(true);
      })();
    }
    return this.syncPromise;
  }
}
