import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';
import { GoldenDayService } from '../golden-day/golden-day.service';

export type GoldenDayGoal = {
  pushupGoal: number;
  elevationGoal: number;
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly goldenDayService = inject(GoldenDayService);

  readonly version = signal(0);

  async getGoldenDayGoal(): Promise<GoldenDayGoal> {
    try {
      return await fetchJson<GoldenDayGoal>(this.http, '/api/settings/golden-day-goal');
    } catch (e) {
      this.showError('Unable to load settings');
      throw e;
    }
  }

  async updateGoldenDayGoal(goal: GoldenDayGoal): Promise<GoldenDayGoal> {
    try {
      const saved = await fetchJson<GoldenDayGoal>(
        this.http,
        '/api/settings/golden-day-goal',
        { method: 'put', body: goal }
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
