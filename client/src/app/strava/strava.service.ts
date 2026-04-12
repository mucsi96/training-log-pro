import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  EMPTY,
  catchError,
  concat,
  mergeMap,
  shareReplay
} from 'rxjs';
import { NotificationService } from '../common-components/notification.service';
import { WithingsService } from '../withings/withings.service';

@Injectable({ providedIn: 'root' })
export class StravaService {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly withingsService = inject(WithingsService);

  private readonly $syncActivities = concat(
    this.withingsService.syncMeasurements(),
    this.http.post<void>('/api/strava/activities/sync', undefined).pipe(
      mergeMap(() => EMPTY),
      catchError((e) => {
        this.notificationService.showNotification(
          'Unable to sync with Strava',
          'error'
        );
        return EMPTY;
      }),
      shareReplay(1)
    )
  );

  syncActivities() {
    return this.$syncActivities;
  }
}
