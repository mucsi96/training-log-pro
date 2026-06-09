import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from '../utils/fetchJson';

export type Meeting = {
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
};

export type ExtractedMeetings = {
  meetings: Meeting[];
};

export type MeetingReview = Meeting & {
  attend: boolean;
  requiresOffice: boolean;
};

export type ScheduleBlock = {
  startTime: string;
  endTime: string;
  title: string;
  type: string;
  details?: string;
};

export type DaySchedule = {
  date: string;
  commuteMode: string;
  blocks: ScheduleBlock[];
};

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async getToday(): Promise<DaySchedule | null> {
    try {
      return await fetchJson<DaySchedule | null>(this.http, '/api/schedule');
    } catch (e) {
      this.notifications.error('Unable to load today\'s schedule');
      throw e;
    }
  }

  async extract(photo: File): Promise<ExtractedMeetings> {
    const formData = new FormData();
    formData.append('photo', photo);
    try {
      return await firstValueFrom(
        this.http.post<ExtractedMeetings>('/api/schedule/extract', formData)
      );
    } catch (e) {
      this.notifications.error('Unable to read the calendar photo');
      throw e;
    }
  }

  async plan(meetings: MeetingReview[]): Promise<DaySchedule> {
    try {
      const schedule = await fetchJson<DaySchedule>(
        this.http,
        '/api/schedule/plan',
        { method: 'post', body: { meetings } }
      );
      this.version.update((v) => v + 1);
      return schedule;
    } catch (e) {
      this.notifications.error('Unable to generate the schedule');
      throw e;
    }
  }
}
