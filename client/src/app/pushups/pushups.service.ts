import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { fetchJson } from '../utils/fetchJson';

export type PushupSet = {
  createdAt: Date;
  count: number;
};

type PushupSetDto = {
  createdAt: string;
  count: number;
};

@Injectable({ providedIn: 'root' })
export class PushupsService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  readonly version = signal(0);

  async getSets(period = 0): Promise<PushupSet[]> {
    const url = period ? `/api/pushups?period=${period}` : '/api/pushups';
    try {
      const sets = await fetchJson<PushupSetDto[]>(this.http, url);
      return sets.map((set) => ({ ...set, createdAt: new Date(set.createdAt) }));
    } catch (e) {
      this.showError('Unable to fetch pushups');
      throw e;
    }
  }

  async addSet(count: number): Promise<PushupSet> {
    try {
      const set = await fetchJson<PushupSetDto>(this.http, '/api/pushups', {
        method: 'post',
        body: { count },
      });
      this.version.update((v) => v + 1);
      return { ...set, createdAt: new Date(set.createdAt) };
    } catch (e) {
      this.showError('Unable to add pushups');
      throw e;
    }
  }

  async deleteSet(createdAt: Date): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/pushups/${createdAt.getTime()}`, {
        method: 'delete',
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.showError('Unable to remove set');
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
