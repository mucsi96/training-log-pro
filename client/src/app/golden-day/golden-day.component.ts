import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { GoldenDayService } from './golden-day.service';
import { ConfettiComponent } from './confetti/confetti.component';

const CONFETTI_DURATION_MS = 5000;

@Component({
  standalone: true,
  selector: 'app-golden-day',
  imports: [ConfettiComponent],
  templateUrl: './golden-day.component.html',
  styleUrl: './golden-day.component.css',
})
export class GoldenDayComponent {
  private readonly service = inject(GoldenDayService);

  readonly stats = resource({
    params: () => ({
      version: this.service.version(),
      pushups: this.service.pushupsService.version(),
      reading: this.service.readingService.version(),
    }),
    loader: () => this.service.getStats(),
  });

  readonly showConfetti = signal(false);
  private confettiTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly monthCount = computed(() => this.stats.value()?.monthCount ?? 0);
  readonly streak = computed(() => this.stats.value()?.currentStreak ?? 0);
  readonly todayGolden = computed(() => this.stats.value()?.todayGolden ?? false);
  readonly pushups = computed(() => this.stats.value()?.todayPushups ?? 0);
  readonly elevation = computed(() => this.stats.value()?.todayElevationGain ?? 0);
  readonly pushupGoal = computed(() => this.stats.value()?.pushupGoal ?? 100);
  readonly elevationGoal = computed(() => this.stats.value()?.elevationGoal ?? 250);
  readonly elevationDisplay = computed(() => Math.round(this.elevation()));
  readonly readingPages = computed(() => this.stats.value()?.todayReadingPages ?? 0);
  readonly readingGoal = computed(() => this.stats.value()?.readingPagesGoal ?? 0);

  constructor() {
    effect(() => {
      const value = this.stats.value();
      if (!value?.celebrateToday) {
        return;
      }
      this.fireConfetti();
      this.service.markCelebrated();
    });
  }

  private fireConfetti() {
    if (this.confettiTimeoutId !== null) {
      clearTimeout(this.confettiTimeoutId);
    }
    this.showConfetti.set(true);
    this.confettiTimeoutId = setTimeout(() => {
      this.showConfetti.set(false);
      this.confettiTimeoutId = null;
    }, CONFETTI_DURATION_MS);
  }
}
