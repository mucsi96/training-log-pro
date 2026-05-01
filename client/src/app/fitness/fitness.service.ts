import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { fetchJson } from '../utils/fetchJson';

export type FitnessMeasurement = {
  date: Date;
  fitness: number;
  fatigue: number;
  form: number;
};

export type FitnessTimeline = {
  measurements: FitnessMeasurement[];
};

type FitnessTimelineResponse = {
  measurements: { date: string; fitness: number; fatigue: number; form: number }[];
};

@Injectable({ providedIn: 'root' })
export class FitnessService {
  private readonly http = inject(HttpClient);
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cache = new Map<number, FitnessTimeline>();

  async getFitness(period = 0): Promise<FitnessTimeline> {
    const cached = this.cache.get(period);
    if (cached) {
      return cached;
    }

    await this.stravaService.sync();
    const url = period ? `/api/fitness?period=${period}` : '/api/fitness';
    try {
      const response = await fetchJson<FitnessTimelineResponse>(this.http, url);
      const result: FitnessTimeline = {
        measurements: response.measurements.map((m) => ({
          ...m,
          date: new Date(m.date),
        })),
      };
      this.cache.set(period, result);
      return result;
    } catch (e) {
      this.snackBar.open('Unable to fetch fitness', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: ['error'],
      });
      throw e;
    }
  }
}
