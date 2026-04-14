import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from '../common-components/notification.service';
import { fetchJson } from '../utils/fetchJson';

@Injectable({ providedIn: 'root' })
export class WithingsService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private syncPromise: Promise<void> | undefined;

  sync(): Promise<void> {
    if (!this.syncPromise) {
      this.syncPromise = fetchJson<void>(this.http, '/api/withings/sync', {
        method: 'post',
      }).catch((error: HttpErrorResponse) => {
        if (error.status === 401 && error.error?._links?.oauth2Login?.href) {
          return this.redirectToAuthorize(
            error.error._links.oauth2Login.href
          );
        }
        this.notificationService.showNotification(
          'Unable to sync with Withings',
          'error'
        );
        return;
      });
    }
    return this.syncPromise;
  }

  private async redirectToAuthorize(authorizeUrl: string): Promise<void> {
    const { token } = await fetchJson<{ token: string }>(
      this.http,
      '/api/authorize-token',
      { method: 'post' }
    );
    window.location.href = `${authorizeUrl}?token=${token}`;
  }
}
