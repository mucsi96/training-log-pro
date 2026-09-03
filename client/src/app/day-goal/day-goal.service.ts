import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { StravaService } from '../strava/strava.service';
import { PushupsService } from '../pushups/pushups.service';
import { ReadingService } from '../reading/reading.service';
import { CoinsService } from '../coins/coins.service';
import { fetchJson } from '../utils/fetchJson';
import { DayGoalStats } from './day-goal.model';

@Injectable({ providedIn: 'root' })
export class DayGoalService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private readonly stravaService = inject(StravaService);
  private readonly coinsService = inject(CoinsService);
  readonly pushupsService = inject(PushupsService);
  readonly readingService = inject(ReadingService);

  readonly version = signal(0);

  async getStats(): Promise<DayGoalStats> {
    await this.stravaService.sync();
    try {
      const stats = await fetchJson<DayGoalStats>(this.http, '/api/day-goal');
      this.coinsService.refresh();
      return stats;
    } catch (e) {
      this.notifications.error('Unable to fetch day goal stats');
      throw e;
    }
  }

  async markCelebrated(): Promise<void> {
    await fetchJson<void>(this.http, '/api/day-goal/celebrate', { method: 'post' });
  }
}
