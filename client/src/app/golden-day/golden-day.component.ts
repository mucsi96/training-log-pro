import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { GoldenDayService } from './golden-day.service';

const CONFETTI_COUNT = 36;
const CONFETTI_DURATION_MS = 2600;

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  rotation: number;
  color: string;
  size: number;
};

const CONFETTI_COLORS = [
  'hsl(45, 100%, 60%)',
  'hsl(30, 100%, 60%)',
  'hsl(145, 78%, 55%)',
  'hsl(220, 89%, 63%)',
  'hsl(0, 96%, 70%)',
];

@Component({
  standalone: true,
  selector: 'app-golden-day',
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

  readonly confetti = signal<ConfettiPiece[]>([]);
  private previousGolden: boolean | undefined;

  readonly monthCount = computed(() => this.stats.value()?.monthCount ?? 0);
  readonly streak = computed(() => this.stats.value()?.currentStreak ?? 0);
  readonly todayGolden = computed(() => this.stats.value()?.todayGolden ?? false);
  readonly pushups = computed(() => this.stats.value()?.todayPushups ?? 0);
  readonly elevation = computed(() => this.stats.value()?.todayElevationGain ?? 0);
  readonly pushupGoal = computed(() => this.stats.value()?.pushupGoal ?? 100);
  readonly elevationGoal = computed(() => this.stats.value()?.elevationGoal ?? 250);
  readonly elevationDisplay = computed(() => Math.round(this.elevation()));
  readonly readingPages = computed(() => this.stats.value()?.todayReadingPages ?? 0);
  readonly readingGoal = computed(() => this.stats.value()?.readingPagesGoal ?? 30);

  constructor() {
    effect(() => {
      const value = this.stats.value();
      if (!value) {
        return;
      }
      const golden = value.todayGolden;
      const previous = this.previousGolden;
      this.previousGolden = golden;
      if (previous === false && golden) {
        this.fireConfetti();
      }
    });
  }

  private fireConfetti() {
    const pieces: ConfettiPiece[] = Array.from({ length: CONFETTI_COUNT }, (_, id) => ({
      id,
      left: Math.random() * 100,
      delay: Math.random() * 250,
      duration: CONFETTI_DURATION_MS - Math.random() * 600,
      drift: (Math.random() - 0.5) * 120,
      rotation: Math.random() * 720 - 360,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
    }));
    this.confetti.set(pieces);
    setTimeout(() => this.confetti.set([]), CONFETTI_DURATION_MS + 400);
  }
}
