import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import {
  MeetingReview,
  ScheduleService,
  WeekSchedule,
} from './schedule.service';

type Step = 'capture' | 'review' | 'week';

type MeetingGroup = {
  date: string;
  items: { meeting: MeetingReview; index: number }[];
};

@Component({
  standalone: true,
  selector: 'app-schedule',
  imports: [MatButtonModule, MatSlideToggleModule, BarLoaderComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.css',
})
export class ScheduleComponent {
  private readonly scheduleService = inject(ScheduleService);

  readonly step = signal<Step>('capture');
  readonly photoPreview = signal<string | null>(null);
  readonly meetings = signal<MeetingReview[]>([]);
  readonly week = signal<WeekSchedule | null>(null);

  readonly loadingWeek = signal(true);
  readonly extracting = signal(false);
  readonly planning = signal(false);

  readonly meetingGroups = computed<MeetingGroup[]>(() => {
    const groups = new Map<string, MeetingGroup>();
    this.meetings().forEach((meeting, index) => {
      const group = groups.get(meeting.date) ?? { date: meeting.date, items: [] };
      group.items.push({ meeting, index });
      groups.set(meeting.date, group);
    });
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  });

  readonly hasMeetings = computed(() => this.meetings().length > 0);

  constructor() {
    // getWeek already surfaces failures via the notifications service; catch here
    // so the discarded promise never becomes an unhandled rejection.
    this.loadWeek().catch(() => {});
  }

  private async loadWeek() {
    try {
      const week = await this.scheduleService.getWeek();
      if (week) {
        this.week.set(week);
        this.step.set('week');
      }
    } finally {
      this.loadingWeek.set(false);
    }
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.revokePreview();
    this.photoPreview.set(URL.createObjectURL(file));
    this.extracting.set(true);
    try {
      const extracted = await this.scheduleService.extract(file);
      this.meetings.set(
        extracted.meetings.map((meeting) => ({
          ...meeting,
          attend: true,
          requiresOffice: false,
        }))
      );
      this.step.set('review');
    } finally {
      this.extracting.set(false);
    }
  }

  toggleAttend(index: number, attend: boolean) {
    this.meetings.update((meetings) =>
      meetings.map((meeting, i) => (i === index ? { ...meeting, attend } : meeting))
    );
  }

  toggleOffice(index: number, requiresOffice: boolean) {
    this.meetings.update((meetings) =>
      meetings.map((meeting, i) =>
        i === index ? { ...meeting, requiresOffice } : meeting
      )
    );
  }

  async generate() {
    this.planning.set(true);
    try {
      const week = await this.scheduleService.plan(this.meetings());
      this.week.set(week);
      this.step.set('week');
    } finally {
      this.planning.set(false);
    }
  }

  replan() {
    this.revokePreview();
    this.meetings.set([]);
    this.step.set('capture');
  }

  private revokePreview() {
    const previous = this.photoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
      this.photoPreview.set(null);
    }
  }
}
