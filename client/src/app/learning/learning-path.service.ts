import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { fetchJson } from '../utils/fetchJson';

export type LearningPathBlock = {
  id?: string;
  type: string;
  title: string;
  description?: string;
  url?: string;
  completed?: boolean;
};

export type LearningPathTopic = {
  id?: string;
  title: string;
  blocks: LearningPathBlock[];
};

export type LearningPathContent = {
  summary: string;
  topics: LearningPathTopic[];
};

export type LearningPath = {
  id: string;
  title: string;
  content: LearningPathContent;
  createdAt: string;
  completedAt?: string;
};

export type LearningPathStatus = {
  id: string;
  title: string;
  active: boolean;
};

@Injectable({ providedIn: 'root' })
export class LearningPathService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async getPaths(): Promise<LearningPath[]> {
    try {
      return await fetchJson<LearningPath[]>(this.http, '/api/learning-paths');
    } catch (e) {
      this.notifications.error('Unable to load learning paths');
      throw e;
    }
  }

  async getToday(): Promise<LearningPathStatus[]> {
    try {
      return await fetchJson<LearningPathStatus[]>(
        this.http,
        '/api/learning-paths/today'
      );
    } catch (e) {
      this.notifications.error("Unable to load today's learning paths");
      throw e;
    }
  }

  async generate(
    prompt: string,
    content?: LearningPathContent
  ): Promise<LearningPathContent> {
    try {
      return await fetchJson<LearningPathContent>(
        this.http,
        '/api/learning-paths/generate',
        { method: 'post', body: { prompt, content } }
      );
    } catch (e) {
      this.notifications.error('Unable to generate learning path');
      throw e;
    }
  }

  async savePath(
    title: string,
    content: LearningPathContent
  ): Promise<LearningPath> {
    try {
      const path = await fetchJson<LearningPath>(
        this.http,
        '/api/learning-paths',
        { method: 'post', body: { title, content } }
      );
      this.version.update((v) => v + 1);
      return path;
    } catch (e) {
      this.notifications.error('Unable to save learning path');
      throw e;
    }
  }

  async updatePath(
    id: string,
    title: string,
    content: LearningPathContent
  ): Promise<LearningPath> {
    try {
      const path = await fetchJson<LearningPath>(
        this.http,
        `/api/learning-paths/${id}`,
        { method: 'put', body: { title, content } }
      );
      this.version.update((v) => v + 1);
      return path;
    } catch (e) {
      this.notifications.error('Unable to update learning path');
      throw e;
    }
  }

  async deletePath(id: string): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/learning-paths/${id}`, {
        method: 'delete',
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to delete learning path');
      throw e;
    }
  }

  async setBlockCompleted(
    id: string,
    blockId: string,
    completed: boolean
  ): Promise<LearningPath> {
    try {
      const path = await fetchJson<LearningPath>(
        this.http,
        `/api/learning-paths/${id}/blocks/${blockId}`,
        { method: 'put', body: { completed } }
      );
      this.version.update((v) => v + 1);
      return path;
    } catch (e) {
      this.notifications.error('Unable to update progress');
      throw e;
    }
  }

  async setActivity(id: string, active: boolean): Promise<void> {
    try {
      await fetchJson<void>(this.http, `/api/learning-paths/${id}/activity`, {
        method: 'put',
        body: { active },
      });
      this.version.update((v) => v + 1);
    } catch (e) {
      this.notifications.error('Unable to update learning activity');
      throw e;
    }
  }
}
