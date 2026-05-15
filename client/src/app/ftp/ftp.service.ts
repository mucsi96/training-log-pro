import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { fetchJson } from '../utils/fetchJson';

export type FtpMeasurement = {
  date: Date;
  ftp: number;
  weight: number;
  ftpPerKg: number;
};

export type FtpTimeline = {
  measurements: FtpMeasurement[];
};

type FtpTimelineResponse = {
  measurements: { date: string; ftp: number; weight: number; ftpPerKg: number }[];
};

@Injectable({ providedIn: 'root' })
export class FtpService {
  private readonly http = inject(HttpClient);
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cache = new Map<number, FtpTimeline>();

  async getFtp(period = 0): Promise<FtpTimeline> {
    const cached = this.cache.get(period);
    if (cached) {
      return cached;
    }

    await this.stravaService.sync();
    const url = period ? `/api/ftp?period=${period}` : '/api/ftp';
    try {
      const response = await fetchJson<FtpTimelineResponse>(this.http, url);
      const result: FtpTimeline = {
        measurements: response.measurements.map((m) => ({
          ...m,
          date: new Date(m.date),
        })),
      };
      this.cache.set(period, result);
      return result;
    } catch (e) {
      this.snackBar.open('Unable to fetch FTP', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: ['error'],
      });
      throw e;
    }
  }
}
