import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';
import { GoldenDayService } from '../golden-day/golden-day.service';

export type Settings = {
  pushupGoal: number;
  elevationGoal: number;
  readingPagesGoal: number;
  dailyTaskGoal: number;
  workStartTime: string;
  workEndTime: string;
  rainThresholdMm: number;
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private readonly goldenDayService = inject(GoldenDayService);

  readonly version = signal(0);

  async getSettings(): Promise<Settings> {
    try {
      return await fetchJson<Settings>(this.http, '/api/settings');
    } catch (e) {
      this.notifications.error('Unable to load settings');
      throw e;
    }
  }

  async updateSettings(settings: Settings): Promise<Settings> {
    try {
      const saved = await fetchJson<Settings>(
        this.http,
        '/api/settings',
        { method: 'put', body: settings }
      );
      this.version.update((v) => v + 1);
      this.goldenDayService.version.update((v) => v + 1);
      this.notifications.success('Settings saved');
      return saved;
    } catch (e) {
      this.notifications.error('Unable to save settings');
      throw e;
    }
  }
}
