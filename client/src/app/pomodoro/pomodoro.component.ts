import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';

const DURATION_SECONDS = 25 * 60;

@Component({
  selector: 'app-pomodoro',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './pomodoro.component.html',
  styleUrl: './pomodoro.component.css',
  host: {
    '(document:visibilitychange)': 'refresh()',
    '(window:focus)': 'refresh()',
  },
})
export class PomodoroComponent {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly favicon = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
  private readonly originalTitle = this.title.getTitle();
  private readonly originalIcon = this.favicon.href;
  private readonly originalIconType = this.favicon.type;
  private deadline = 0;
  private interval: ReturnType<typeof setInterval> | undefined;
  private flashing = false;
  private notification: Notification | undefined;

  readonly state = signal<'idle' | 'running' | 'completed'>('idle');
  readonly remainingSeconds = signal(DURATION_SECONDS);
  readonly countdown = computed(() => {
    const seconds = this.remainingSeconds();
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  start(): void {
    if (this.state() !== 'idle') {
      return;
    }

    this.deadline = Date.now() + DURATION_SECONDS * 1000;
    this.remainingSeconds.set(DURATION_SECONDS);
    this.state.set('running');
    this.updateTab();
    this.interval = setInterval(() => this.refresh(), 1000);

    // Request from the button gesture; notification permission never delays the timer.
    if ('Notification' in window && window.isSecureContext && Notification.permission === 'default') {
      void Notification.requestPermission().catch((error) => {
        console.warn('Pomodoro notification permission could not be requested', error);
      });
    }
  }

  refresh(): void {
    if (this.state() === 'idle') {
      return;
    }

    if (this.state() === 'running') {
      this.remainingSeconds.set(Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000)));
      if (this.remainingSeconds() === 0) {
        this.state.set('completed');
        this.flashing = true;
        this.notify();
      }
    } else {
      this.flashing = !this.flashing;
    }

    this.updateTab();
  }

  reset(): void {
    clearInterval(this.interval);
    this.interval = undefined;
    this.state.set('idle');
    this.remainingSeconds.set(DURATION_SECONDS);
    this.flashing = false;
    this.notification?.close();
    this.notification = undefined;
    this.title.setTitle(this.originalTitle);
    this.favicon.href = this.originalIcon;
    this.favicon.type = this.originalIconType;
  }

  private updateTab(): void {
    const completed = this.state() === 'completed';
    this.title.setTitle(
      `${completed && this.flashing ? "Time's up!" : this.countdown()} · ${this.originalTitle}`
    );

    const progress = this.remainingSeconds() / DURATION_SECONDS;
    const color = completed || progress <= 0.2 ? '#ef5350' : progress <= 0.5 ? '#ffa726' : '#66bb6a';
    const ring = completed ? (this.flashing ? 100 : 0) : progress * 100;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="12" fill="none" stroke="#37474f" stroke-width="7"/>
      <circle cx="16" cy="16" r="12" fill="none" stroke="${color}" stroke-width="7"
        pathLength="100" stroke-dasharray="${ring} 100" transform="rotate(-90 16 16)"/>
    </svg>`;
    this.favicon.type = 'image/svg+xml';
    this.favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  private notify(): void {
    if (!('Notification' in window) || !window.isSecureContext || Notification.permission !== 'granted') {
      return;
    }

    try {
      this.notification = new Notification('Pomodoro complete', {
        body: 'Your 25-minute focus session is over. Time for a break!',
        icon: this.originalIcon,
        tag: 'pomodoro-complete',
      });
      this.notification.onclick = () => {
        window.focus();
        this.reset();
      };
    } catch (error) {
      // The tab signal remains available if the browser cannot deliver notifications.
      console.warn('Pomodoro notification could not be shown', error);
    }
  }
}
