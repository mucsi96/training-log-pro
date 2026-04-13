import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NotificationService } from '../common-components/notification.service';
import { WithingsService } from '../withings/withings.service';
import { fetchJson } from '../utils/fetchJson';

export type WeightMeasurement = {
  date: Date;
  weight: number;
  fatRatio?: number;
  fatMassWeight?: number;
};

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly http = inject(HttpClient);
  private readonly withingsService = inject(WithingsService);
  private readonly notificationService = inject(NotificationService);
  private readonly cache = new Map<number, WeightMeasurement[]>();

  async getWeight(period = 0): Promise<WeightMeasurement[]> {
    const cached = this.cache.get(period);
    if (cached) {
      return cached;
    }

    await this.withingsService.sync();
    const url = period ? `/api/weight?period=${period}` : '/api/weight';
    try {
      const measurements = await fetchJson<WeightMeasurement[]>(this.http, url);
      const result = measurements.map((measurement) => ({
        ...measurement,
        date: new Date(measurement.date),
      }));
      this.cache.set(period, result);
      return result;
    } catch (e) {
      this.notificationService.showNotification(
        'Unable to fetch weight',
        'error'
      );
      throw e;
    }
  }

  async getTodayWeight(): Promise<WeightMeasurement | undefined> {
    const measurements = await this.getWeight(1);
    return measurements.at(-1);
  }
}
