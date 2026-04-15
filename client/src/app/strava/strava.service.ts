import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly withingsService = inject(WithingsService);
  private syncPromise: Promise<void> | undefined;

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = this.withingsService
        .sync()
        .then(() =>
          fetchJson<void>(this.http, '/api/strava/activities/sync', {
            method: 'post',
          })
        )
        .catch((error: HttpErrorResponse) => {
          const authorizeUrl = error.error?._links?.oauth2Login?.href;
          if (error.status === 401 && authorizeUrl) {
            window.location.href = authorizeUrl;
            return;
          }
          this.snackBar.open('Unable to sync with Strava', 'Close', {
            duration: 3000,
            verticalPosition: 'top',
            panelClass: ['error'],
          });
        });
    }
    return this.syncPromise;
  }
}
