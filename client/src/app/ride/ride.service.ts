import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { fetchJson } from '../utils/fetchJson';

export type RideStats = {
  calories?: number;
  elevationGain?: number;
  distance?: number;
  time?: number;
};

export type PodiumPeriod = 'WEEK' | 'MONTH' | 'ALL_TIME';

export type PodiumMessage = {
  segmentName: string;
  period: PodiumPeriod;
  position: number;
  message: string;
};

@Injectable({ providedIn: 'root' })
export class RideService {
  private readonly http = inject(HttpClient);
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cache = new Map<number, RideStats>();
  private podiumPromise: Promise<PodiumMessage | undefined> | undefined;

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

  async getPodiumMessage(): Promise<PodiumMessage | undefined> {
    if (this.podiumPromise) {
      return this.podiumPromise;
    }
    this.podiumPromise = (async () => {
      await this.stravaService.sync();
      try {
        const response = await firstValueFrom(
          this.http.get<PodiumMessage>('/api/ride/podium', { observe: 'response' })
        );
        if (response.status === 204) {
          return undefined;
        }
        return response.body ?? undefined;
      } catch {
        return undefined;
      }
    })();
    return this.podiumPromise;
  }
}
