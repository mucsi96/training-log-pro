import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from '../common-components/notification.service';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
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
        .catch(() => {
          this.notificationService.showNotification(
            'Unable to sync with Strava',
            'error'
          );
        });
    }
    return this.syncPromise;
  }
}
