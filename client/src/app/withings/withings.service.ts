import { HttpClient } from '@angular/common/http';
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
      }).catch(() => {
        this.notificationService.showNotification(
          'Unable to sync with Withings',
          'error'
        );
      });
    }
    return this.syncPromise;
  }
}
