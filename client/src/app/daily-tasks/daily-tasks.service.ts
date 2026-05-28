import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type DailyTask = {
  id: string;
  name: string;
};

export type DailyTaskStatus = {
  id: string;
  name: string;
  completed: boolean;
};

@Injectable({ providedIn: 'root' })
export class DailyTasksService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async listTasks(): Promise<DailyTask[]> {
    try {
      return await fetchJson<DailyTask[]>(this.http, '/api/tasks');
    } catch (e) {
      this.notifications.error('Unable to load tasks');
      throw e;
    }
  }

  async getToday(): Promise<DailyTaskStatus[]> {
    try {
      return await fetchJson<DailyTaskStatus[]>(this.http, '/api/tasks/today');
    } catch (e) {
      this.notifications.error('Unable to load today\'s tasks');
      throw e;
    }
  }

  async addTask(name: string): Promise<DailyTask> {
    try {
      const task = await fetchJson<DailyTask>(this.http, '/api/tasks', {
        method: 'post',
        body: { name },
      });
      this.version.update((v) => v + 1);
      return task;
    } catch (e) {
      this.notifications.error('Unable to add task');
      throw e;
    }
  }

  async renameTask(id: string, name: string): Promise<DailyTask> {
    try {
      const task = await fetchJson<DailyTask>(this.http, `/api/tasks/${id}`, {
        method: 'put',
        body: { name },
      });
      this.version.update((v) => v + 1);
      return task;
    } catch (e) {
      this.notifications.error('Unable to update task');
      throw e;
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/tasks/${id}`, { method: 'delete' });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to delete task');
      throw e;
    }
  }

  async setCompletion(id: string, completed: boolean): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/tasks/${id}/completion`, {
        method: 'put',
        body: { completed },
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to update task status');
      throw e;
    }
  }
}
