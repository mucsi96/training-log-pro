import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';

export type WeightMeasurement = {
  date: Date;
  weight: number;
  fatRatio?: number;
  fatMassWeight?: number;
};

export type WeightHistory = {
  measurements: WeightMeasurement[];
  baseline?: WeightMeasurement;
};

type WeightHistoryResponse = {
  measurements: WeightMeasurement[];
  baseline?: WeightMeasurement;
};

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly http = inject(HttpClient);
  private readonly withingsService = inject(WithingsService);
  private readonly notifications = inject(NotificationsService);
  private readonly cache = new Map<number, WeightHistory>();

  async getWeight(period = 0): Promise<WeightHistory> {
    const cached = this.cache.get(period);
    if (cached) {
      return cached;
    }

    await this.withingsService.sync();
    const url = period ? `/api/weight?period=${period}` : '/api/weight';
    try {
      const response = await fetchJson<WeightHistoryResponse>(this.http, url);
      const result: WeightHistory = {
        measurements: response.measurements.map((measurement) => ({
          ...measurement,
          date: new Date(measurement.date),
        })),
        ...(response.baseline && {
          baseline: {
            ...response.baseline,
            date: new Date(response.baseline.date),
          },
        }),
      };
      this.cache.set(period, result);
      return result;
    } catch (e) {
      this.notifications.error('Unable to fetch weight');
      throw e;
    }
  }

  async getTodayWeight(): Promise<WeightHistory> {
    return this.getWeight(1);
  }
}
