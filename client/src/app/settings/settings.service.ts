import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';
import { DayGoalService } from '../day-goal/day-goal.service';
import { TierGoals } from '../day-goal/day-goal.model';

export type Settings = {
  readonly tiers: TierGoals[];
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  private readonly dayGoalService = inject(DayGoalService);

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
      this.dayGoalService.version.update((v) => v + 1);
      this.notifications.success('Settings saved');
      return saved;
    } catch (e) {
      this.notifications.error('Unable to save settings');
      throw e;
    }
  }
}
