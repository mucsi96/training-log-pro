import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type Location = {
  id: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  home: boolean;
  bikeMinutesFromHome?: number | null;
  carMinutesFromHome?: number | null;
};

export type LocationRequest = Omit<Location, 'id'>;

@Injectable({ providedIn: 'root' })
export class LocationsService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async listLocations(): Promise<Location[]> {
    try {
      return await fetchJson<Location[]>(this.http, '/api/locations');
    } catch (e) {
      this.notifications.error('Unable to load locations');
      throw e;
    }
  }

  async addLocation(location: LocationRequest): Promise<Location> {
    return this.mutate('/api/locations', 'post', location, 'Unable to add location');
  }

  async updateLocation(id: string, location: LocationRequest): Promise<Location> {
    return this.mutate(`/api/locations/${id}`, 'put', location, 'Unable to update location');
  }

  async deleteLocation(id: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/locations/${id}`, { method: 'delete' });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to delete location');
      throw e;
    }
  }

  private async mutate(
    url: string,
    method: string,
    body: LocationRequest,
    errorMessage: string
  ): Promise<Location> {
    try {
      const saved = await fetchJson<Location>(this.http, url, { method, body });
      this.version.update((v) => v + 1);
      return saved;
    } catch (e) {
      this.notifications.error(errorMessage);
      throw e;
    }
  }
}
