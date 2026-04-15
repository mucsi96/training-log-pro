import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { fetchJson } from '../utils/fetchJson';

export type RideStats = {
  calories?: number;
  elevationGain?: number;
  distance?: number;
  time?: number;
};

@Injectable({ providedIn: 'root' })
export class RideService {
  private readonly http = inject(HttpClient);
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cache = new Map<number, RideStats>();

  async getRideStats(period = 0): Promise<RideStats> {
    const cached = this.cache.get(period);
    if (cached) {
      return cached;
    }

    await this.stravaService.sync();
    const url = period ? `/api/ride/stats?period=${period}` : '/api/ride/stats';
    try {
      const stats = await fetchJson<RideStats>(this.http, url);
      this.cache.set(period, stats);
      return stats;
    } catch (e) {
      this.snackBar.open('Unable to fetch ride stats', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: ['error'],
      });
      throw e;
    }
  }
}
