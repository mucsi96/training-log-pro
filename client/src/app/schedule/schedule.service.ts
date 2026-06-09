import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { firstValueFrom } from 'rxjs';
import { fetchJson } from '../utils/fetchJson';

export type Meeting = {
  date: string;
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
};

export type WeekMeetings = {
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

export type WeekSchedule = {
  weekStart: string;
  days: DaySchedule[];
};

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(NotificationsService);

  readonly version = signal(0);

  async getWeek(): Promise<WeekSchedule | null> {
    try {
      return await fetchJson<WeekSchedule | null>(this.http, '/api/schedule');
    } catch (e) {
      this.notifications.error('Unable to load this week\'s schedule');
      throw e;
    }
  }

  async extract(photo: File): Promise<WeekMeetings> {
    const formData = new FormData();
    formData.append('photo', photo);
    try {
      return await firstValueFrom(
        this.http.post<WeekMeetings>('/api/schedule/extract', formData)
      );
    } catch (e) {
      this.notifications.error('Unable to read the calendar photo');
      throw e;
    }
  }

  async plan(meetings: MeetingReview[]): Promise<WeekSchedule> {
    try {
      const schedule = await fetchJson<WeekSchedule>(
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
