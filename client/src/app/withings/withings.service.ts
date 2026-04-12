import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, catchError, mergeMap, shareReplay } from 'rxjs';
import { NotificationService } from '../common-components/notification.service';

@Injectable({ providedIn: 'root' })
export class WithingsService {
  private readonly $syncMeasurements: Observable<never>;

  constructor(
    private readonly http: HttpClient,
    private readonly notificationService: NotificationService
  ) {
    this.$syncMeasurements = this.http
      .post<void>('/api/withings/sync', undefined)
      .pipe(
        mergeMap(() => EMPTY),
        catchError((e) => {
          this.notificationService.showNotification(
            'Unable to sync with Withings',
            'error'
          );
          return EMPTY;
        }),
        shareReplay(1)
      );
  }

  syncMeasurements() {
    return this.$syncMeasurements;
  }
}
