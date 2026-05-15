import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';
import { GoldenDayService } from '../golden-day/golden-day.service';

export type Settings = {
  pushupGoal: number;
  elevationGoal: number;
  readingPagesGoal: number;
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly goldenDayService = inject(GoldenDayService);

  readonly version = signal(0);

  async getSettings(): Promise<Settings> {
    try {
      return await fetchJson<Settings>(this.http, '/api/settings');
    } catch (e) {
      this.showError('Unable to load settings');
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
      this.snackBar.open('Settings saved', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
      });
      return saved;
    } catch (e) {
      this.showError('Unable to save settings');
      throw e;
    }
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      verticalPosition: 'top',
      panelClass: ['error'],
    });
  }
}
