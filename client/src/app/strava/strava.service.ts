import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';
import { haltForNavigation } from '../utils/auth';

const REDIRECT_GUARD_KEY = 'strava-authorize-redirected';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private readonly withingsService = inject(WithingsService);
  private syncPromise: Promise<void> | undefined;
  private readonly _isSynced = signal(false);
  readonly isSynced = this._isSynced.asReadonly();

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = (async () => {
        await this.withingsService.sync();
        try {
          await fetchJson<void>(this.http, '/api/strava/activities/sync', {
            method: 'post',
          });
          sessionStorage.removeItem(REDIRECT_GUARD_KEY);
        } catch (error) {
          const httpError = error as HttpErrorResponse;
          const authorizeUrl = httpError.error?._links?.oauth2Login?.href;
          if (httpError.status === 401 && authorizeUrl) {
            if (sessionStorage.getItem(REDIRECT_GUARD_KEY)) {
              this.notifications.error(
                'Unable to authorize Strava. Please try again later.',
                { duration: 5000 }
              );
            } else {
              sessionStorage.setItem(REDIRECT_GUARD_KEY, '1');
              window.location.href = authorizeUrl;
              // Keep this promise pending so the sync flow does not continue
              // after assigning window.location.href, preventing a competing
              // redirect from being scheduled before the browser navigates.
              await haltForNavigation();
            }
          } else {
            this.notifications.error('Unable to sync with Strava');
          }
        }
        this._isSynced.set(true);
      })();
    }
    return this.syncPromise;
  }
}
