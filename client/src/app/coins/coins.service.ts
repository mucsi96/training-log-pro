import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type Coins = {
  totalCoins: number;
  totalPoints: number;
  pointsPerCoin: number;
};

@Injectable({ providedIn: 'root' })
export class CoinsService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async getCoins(): Promise<Coins> {
    try {
      return await fetchJson<Coins>(this.http, '/api/coins');
    } catch (e) {
      this.notifications.error('Unable to load coins');
      throw e;
    }
  }

  async resetCoins(): Promise<Coins> {
    try {
      const coins = await fetchJson<Coins>(this.http, '/api/coins/reset', {
        method: 'post',
      });
      this.version.update((v) => v + 1);
      this.notifications.success('Coins reset');
      return coins;
    } catch (e) {
      this.notifications.error('Unable to reset coins');
      throw e;
    }
  }

  refresh() {
    this.version.update((v) => v + 1);
  }
}
