import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { StravaService } from '../strava/strava.service';
import { PushupsService } from '../pushups/pushups.service';
import { ReadingService } from '../reading/reading.service';
import { CoinsService } from '../coins/coins.service';
import { fetchJson } from '../utils/fetchJson';

export type GoldenDayStats = {
  monthCount: number;
  currentStreak: number;
  todayGolden: boolean;
  celebrateToday: boolean;
  todayPushups: number;
  todayElevationGain: number;
  todayReadingPages: number;
  pushupGoal: number;
  elevationGoal: number;
  readingPagesGoal: number;
  goldenDates: string[];
};

@Injectable({ providedIn: 'root' })
export class GoldenDayService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private readonly stravaService = inject(StravaService);
  private readonly coinsService = inject(CoinsService);
  readonly pushupsService = inject(PushupsService);
  readonly readingService = inject(ReadingService);

  readonly version = signal(0);

  async getStats(): Promise<GoldenDayStats> {
    await this.stravaService.sync();
    try {
      const stats = await fetchJson<GoldenDayStats>(this.http, '/api/golden-day');
      this.coinsService.refresh();
      return stats;
    } catch (e) {
      this.notifications.error('Unable to fetch golden day stats');
      throw e;
    }
  }

  async markCelebrated(): Promise<void> {
    await fetchJson<void>(this.http, '/api/golden-day/celebrate', { method: 'post' });
  }
}
