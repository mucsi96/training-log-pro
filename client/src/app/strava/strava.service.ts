import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from '../common-components/notification.service';
import { ENVIRONMENT_CONFIG } from '../environment/environment.config';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';
import { handleOAuth2Redirect } from '../utils/oauth2';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly withingsService = inject(WithingsService);
  private readonly config = inject(ENVIRONMENT_CONFIG);
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
        .catch((error) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            const href = error.error?._links?.oauth2Login?.href;
            if (href) {
              handleOAuth2Redirect(this.http, href, '/api/strava/auth-token', this.config.mockAuth);
              return;
            }
          }
          this.notificationService.showNotification(
            'Unable to sync with Strava',
            'error'
          );
        });
    }
    return this.syncPromise;
  }
}
