import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StravaService } from '../strava/strava.service';
import { fetchJson } from '../utils/fetchJson';

export type Fitness = {
  fitness: number;
  fatigue: number;
  form: number;
};

@Injectable({ providedIn: 'root' })
export class FitnessService {
  private readonly http = inject(HttpClient);
  private readonly stravaService = inject(StravaService);
  private readonly snackBar = inject(MatSnackBar);

  async getFitness(): Promise<Fitness> {
    await this.stravaService.sync();
    try {
      return await fetchJson<Fitness>(this.http, '/api/fitness');
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
