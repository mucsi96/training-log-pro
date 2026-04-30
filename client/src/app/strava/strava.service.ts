import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';

const REDIRECT_GUARD_KEY = 'strava-authorize-redirected';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
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
              this.snackBar.open(
                'Unable to authorize Strava. Please try again later.',
                'Close',
                {
                  duration: 5000,
                  verticalPosition: 'top',
                  panelClass: ['error'],
                }
              );
            } else {
              sessionStorage.setItem(REDIRECT_GUARD_KEY, '1');
              window.location.href = authorizeUrl;
              await new Promise<never>(() => {});
            }
          } else {
            this.snackBar.open('Unable to sync with Strava', 'Close', {
              duration: 3000,
              verticalPosition: 'top',
              panelClass: ['error'],
            });
          }
        }
        this._isSynced.set(true);
      })();
    }
    return this.syncPromise;
  }
}
