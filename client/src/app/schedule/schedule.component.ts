import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import {
  DaySchedule,
  MeetingReview,
  ScheduleService,
} from './schedule.service';

type Step = 'capture' | 'review' | 'schedule';

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
  readonly schedule = signal<DaySchedule | null>(null);

  readonly loadingToday = signal(true);
  readonly extracting = signal(false);
  readonly planning = signal(false);

  readonly hasMeetings = computed(() => this.meetings().length > 0);

  constructor() {
    this.loadToday();
  }

  private async loadToday() {
    try {
      const schedule = await this.scheduleService.getToday();
      if (schedule) {
        this.schedule.set(schedule);
        this.step.set('schedule');
      }
    } finally {
      this.loadingToday.set(false);
    }
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
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
      meetings.map((meeting, i) =>
        i === index ? { ...meeting, attend } : meeting
      )
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
      const schedule = await this.scheduleService.plan(this.meetings());
      this.schedule.set(schedule);
      this.step.set('schedule');
    } finally {
      this.planning.set(false);
    }
  }

  startOver() {
    this.photoPreview.set(null);
    this.meetings.set([]);
    this.schedule.set(null);
    this.step.set('capture');
  }
}
