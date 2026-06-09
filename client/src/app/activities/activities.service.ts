import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type Activity = {
  id: string;
  name: string;
  durationMinutes: number;
  occurrencesPerWeek: number;
  locationId?: string | null;
  earliestTime?: string;
  latestTime?: string;
  daysOfWeek?: string;
  constraintNote?: string;
  priority?: number | null;
};

export type ActivityRequest = Omit<Activity, 'id'>;

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async listActivities(): Promise<Activity[]> {
    try {
      return await fetchJson<Activity[]>(this.http, '/api/activities');
    } catch (e) {
      this.notifications.error('Unable to load activities');
      throw e;
    }
  }

  async addActivity(activity: ActivityRequest): Promise<Activity> {
    return this.mutate('/api/activities', 'post', activity, 'Unable to add activity');
  }

  async updateActivity(id: string, activity: ActivityRequest): Promise<Activity> {
    return this.mutate(`/api/activities/${id}`, 'put', activity, 'Unable to update activity');
  }

  async deleteActivity(id: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/activities/${id}`, { method: 'delete' });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to delete activity');
      throw e;
    }
  }

  private async mutate(
    url: string,
    method: string,
    body: ActivityRequest,
    errorMessage: string
  ): Promise<Activity> {
    try {
      const saved = await fetchJson<Activity>(this.http, url, { method, body });
      this.version.update((v) => v + 1);
      return saved;
    } catch (e) {
      this.notifications.error(errorMessage);
      throw e;
    }
  }
}
