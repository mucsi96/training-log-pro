import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from '../utils/fetchJson';

export type DeviceBook = {
  id: string;
  fileName: string;
  createdAt: Date;
};

export type Device = {
  id: string;
  name: string;
  createdAt: Date;
  books: DeviceBook[];
};

type DeviceBookDto = {
  id: string;
  fileName: string;
  createdAt: string;
};

type DeviceDto = {
  id: string;
  name: string;
  createdAt: string;
  books: DeviceBookDto[];
};

type CreatedDeviceDto = {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
};

const toDeviceBook = (dto: DeviceBookDto): DeviceBook => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
});

const toDevice = (dto: DeviceDto): Device => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
  books: dto.books.map(toDeviceBook),
});

@Injectable({ providedIn: 'root' })
export class DevicesService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);
  readonly version = signal(0);

  async getDevices(): Promise<Device[]> {
    try {
      const devices = await fetchJson<DeviceDto[]>(this.http, '/api/devices');
      return devices.map(toDevice);
    } catch (e) {
      this.notifications.error('Unable to fetch devices');
      throw e;
    }
  }

  async createDevice(name: string): Promise<string> {
    try {
      const created = await fetchJson<CreatedDeviceDto>(
        this.http,
        '/api/devices',
        { method: 'post', body: { name } }
      );
      this.version.update((v) => v + 1);
      return created.apiKey;
    } catch (e) {
      this.notifications.error('Unable to add device');
      throw e;
    }
  }

  async deleteDevice(deviceId: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/devices/${deviceId}`, {
        method: 'delete',
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to remove device');
      throw e;
    }
  }

  async sendBook(deviceId: string, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      await firstValueFrom(
        this.http.post(`/api/devices/${deviceId}/books`, formData)
      );
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error(`Unable to send ${file.name}`);
      throw e;
    }
  }

  async removeBook(deviceId: string, bookId: string): Promise<void> {
    try {
      await fetchJson<void>(
        this.http,
        `/api/devices/${deviceId}/books/${bookId}`,
        { method: 'delete' }
      );
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to remove book');
      throw e;
    }
  }
}
