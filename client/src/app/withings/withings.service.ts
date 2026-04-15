import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';

@Injectable({ providedIn: 'root' })
export class WithingsService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private syncPromise: Promise<void> | undefined;

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = fetchJson<void>(this.http, '/api/withings/sync', {
        method: 'post',
      }).catch((error: HttpErrorResponse) => {
        const authorizeUrl = error.error?._links?.oauth2Login?.href;
        if (error.status === 401 && authorizeUrl) {
          window.location.href = authorizeUrl;
          return;
        }
        this.snackBar.open('Unable to sync with Withings', 'Close', {
          duration: 3000,
          verticalPosition: 'top',
          panelClass: ['error'],
        });
      });
    }
    return this.syncPromise;
  }
}
