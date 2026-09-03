import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DayGoalService } from './day-goal.service';
import { DailyTasksService } from '../daily-tasks/daily-tasks.service';
import { ConfettiComponent } from './confetti/confetti.component';
import {
  DayGoalMetric,
  DayGoalStats,
  goalsOf,
  isRequired,
  METRICS,
  TIERS,
} from './day-goal.model';

const CONFETTI_DURATION_MS = 5000;

type NextTier = {
  readonly label: string;
  readonly progress: ReadonlyArray<{
    readonly metric: DayGoalMetric;
    readonly value: number;
    readonly goal: number;
    readonly unit: string;
  }>;
};

const nextTierOf = (stats: DayGoalStats | undefined): NextTier | null => {
  if (!stats?.nextTier) {
    return null;
  }
  const values = Object.fromEntries(
    stats.todayProgress.map(({ metric, value }) => [metric, value])
  ) as Record<DayGoalMetric, number>;
  return {
    label: TIERS[stats.nextTier].label.toLowerCase(),
    progress: goalsOf(stats.tiers, stats.nextTier)
      .goals.filter(isRequired)
      .map((goal) => ({
        metric: goal.metric,
        value: Math.round(values[goal.metric]),
        goal: goal.goal,
        unit: METRICS[goal.metric].unit,
      })),
  };
};

@Component({
  standalone: true,
  selector: 'app-day-goal',
  imports: [ConfettiComponent],
  templateUrl: './day-goal.component.html',
  styleUrl: './day-goal.component.css',
})
export class DayGoalComponent {
  private readonly service = inject(DayGoalService);
  private readonly tasksService = inject(DailyTasksService);

  readonly TIERS = TIERS;

  readonly stats = resource({
    params: () => ({
      version: this.service.version(),
      pushups: this.service.pushupsService.version(),
      reading: this.service.readingService.version(),
      tasks: this.tasksService.version(),
    }),
    loader: () => this.service.getStats(),
  });

  readonly showConfetti = signal(false);
  private confettiTimeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly todayTier = computed(() => this.stats.value()?.todayTier ?? null);
  readonly todayLabel = computed(() => {
    const tier = this.todayTier();
    return tier ? TIERS[tier].label.toLowerCase() : null;
  });
  readonly tierClass = computed(() => {
    const tier = this.todayTier();
    return tier ? `day-goal--${tier.toLowerCase()}` : '';
  });
  readonly nextTier = computed(() => nextTierOf(this.stats.value()));
  readonly monthCounts = computed(() => this.stats.value()?.monthCounts ?? []);
  readonly streak = computed(() => this.stats.value()?.currentStreak ?? 0);

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
