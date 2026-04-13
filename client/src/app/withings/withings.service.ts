import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from '../common-components/notification.service';
import { ENVIRONMENT_CONFIG } from '../environment/environment.config';
import { fetchJson } from '../utils/fetchJson';
import { handleOAuth2Redirect } from '../utils/oauth2';

@Injectable({ providedIn: 'root' })
export class WithingsService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly config = inject(ENVIRONMENT_CONFIG);
  private syncPromise: Promise<void> | undefined;

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = fetchJson<void>(this.http, '/api/withings/sync', {
        method: 'post',
      }).catch((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          const href = error.error?._links?.oauth2Login?.href;
          if (href) {
            handleOAuth2Redirect(this.http, href, '/api/withings/auth-token', this.config.mockAuth);
            return;
          }
        }
        this.notificationService.showNotification(
          'Unable to sync with Withings',
          'error'
        );
      });
    }
    return this.syncPromise;
  }
}
