import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { PushupsService } from '../pushups/pushups.service';
import { ReadingService } from '../reading/reading.service';
import { fetchJson } from '../utils/fetchJson';

export type GoldenDayStats = {
  monthCount: number;
  currentStreak: number;
  todayGolden: boolean;
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly stravaService = inject(StravaService);
  readonly pushupsService = inject(PushupsService);
  readonly readingService = inject(ReadingService);

  readonly version = signal(0);

  async getStats(): Promise<GoldenDayStats> {
    await this.stravaService.sync();
    try {
      return await fetchJson<GoldenDayStats>(this.http, '/api/golden-day');
    } catch (e) {
      this.snackBar.open('Unable to fetch golden day stats', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: ['error'],
      });
      throw e;
    }
  }
}
