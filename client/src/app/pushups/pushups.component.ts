import { Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map } from 'rxjs';
import { PushupsService } from './pushups.service';

const DAILY_GOAL = 100;
const QUICK_ADD_VALUES = [-5, 5, 10] as const;

@Component({
  standalone: true,
  imports: [
    NgxEchartsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-pushups',
  templateUrl: './pushups.component.html',
  styleUrl: './pushups.component.css',
})
export class PushupsComponent {
  private readonly pushupsService = inject(PushupsService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };
  readonly goal = DAILY_GOAL;
  readonly quickAddValues = QUICK_ADD_VALUES;
  readonly busy = signal(false);

  readonly todaySets = resource({
    params: () => this.pushupsService.version(),
    loader: () => this.pushupsService.getSets(1),
  });

  readonly periodSets = resource({
    params: () => ({ period: this.period(), version: this.pushupsService.version() }),
    loader: ({ params }) => this.pushupsService.getSets(params.period),
  });

  readonly todayCount = computed(
    () => this.todaySets.value()?.reduce((total, set) => total + set.count, 0) ?? 0
  );

  readonly progressPercent = computed(() =>
    Math.min(100, (this.todayCount() / this.goal) * 100)
  );

  readonly remaining = computed(() => Math.max(0, this.goal - this.todayCount()));

  readonly goalReached = computed(() => this.todayCount() >= this.goal);

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const sets = this.periodSets.value();
    if (!sets) {
      return undefined;
    }

    const totalsByDay = new Map<string, number>();
    for (const set of sets) {
      const day = set.createdAt.toISOString().slice(0, 10);
      totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + set.count);
    }

    const data = [...totalsByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => [new Date(day), total]);

    return {
      aria: { enabled: true },
      animation: false,
      grid: { top: 10, right: 10, bottom: 10, left: 10 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', show: false, min: 0 },
      series: [
        {
          name: 'Pushups',
          type: 'bar',
          data,
          itemStyle: { color: 'hsl(220, 89%, 53%)' },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: 'hsl(218, 11%, 65%)', type: 'dashed' },
            data: [{ yAxis: this.goal }],
          },
        },
      ],
    };
  });

  async add(count: number) {
    if (this.busy() || count === 0 || this.todayCount() + count < 0) {
      return;
    }
    this.busy.set(true);
    try {
      await this.pushupsService.addSet(count);
    } finally {
      this.busy.set(false);
    }
  }

  canApply(value: number): boolean {
    return this.todayCount() + value >= 0;
  }

  formatValue(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }

  ariaForValue(value: number): string {
    return value > 0
      ? `Add ${value} pushups`
      : `Subtract ${-value} pushups`;
  }

}
