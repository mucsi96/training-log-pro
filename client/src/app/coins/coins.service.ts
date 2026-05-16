import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';

export type Coins = {
  totalCoins: number;
  totalPoints: number;
  pointsPerCoin: number;
};

@Injectable({ providedIn: 'root' })
export class CoinsService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly version = signal(0);

  async getCoins(): Promise<Coins> {
    try {
      return await fetchJson<Coins>(this.http, '/api/coins');
    } catch (e) {
      this.showError('Unable to load coins');
      throw e;
    }
  }

  async resetCoins(): Promise<Coins> {
    try {
      const coins = await fetchJson<Coins>(this.http, '/api/coins/reset', {
        method: 'post',
      });
      this.version.update((v) => v + 1);
      this.snackBar.open('Coins reset', 'Close', {
        duration: 3000,
        verticalPosition: 'top',
      });
      return coins;
    } catch (e) {
      this.showError('Unable to reset coins');
      throw e;
    }
  }

  refresh() {
    this.version.update((v) => v + 1);
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      verticalPosition: 'top',
      panelClass: ['error'],
    });
  }
}
