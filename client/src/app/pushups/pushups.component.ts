import { Component, computed, inject, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map } from 'rxjs';
import { PushupsService } from './pushups.service';
import { SettingsService } from '../settings/settings.service';
import {
  PushupsAddDialogComponent,
  PushupsAddDialogResult,
} from './pushups-add-dialog.component';

@Component({
  standalone: true,
  imports: [NgxEchartsModule, MatProgressSpinnerModule],
  selector: 'app-pushups',
  templateUrl: './pushups.component.html',
  styleUrl: './pushups.component.css',
})
export class PushupsComponent {
  private readonly pushupsService = inject(PushupsService);
  private readonly settingsService = inject(SettingsService);
  private readonly dialog = inject(MatDialog);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };
  readonly busy = signal(false);

  readonly settings = resource({
    params: () => this.settingsService.version(),
    loader: () => this.settingsService.getSettings(),
  });

  readonly goal = computed(() => this.settings.value()?.pushupGoal ?? 0);

  readonly periodSets = resource({
    params: () => ({ period: this.period(), version: this.pushupsService.version() }),
    loader: ({ params }) => this.pushupsService.getSets(params.period),
  });

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

    const period = this.period() ?? 0;
    const sortedDays = [...totalsByDay.keys()].sort();

    const endDay = new Date();
    endDay.setUTCHours(0, 0, 0, 0);

    const startDay = new Date(endDay);
    if (period > 0) {
      startDay.setUTCDate(startDay.getUTCDate() - period + 1);
    } else if (sortedDays.length > 0) {
      startDay.setTime(new Date(sortedDays[0]).getTime());
    }

    const data: Array<[Date, number | null]> = [];
    for (
      const current = new Date(startDay);
      current.getTime() <= endDay.getTime();
      current.setUTCDate(current.getUTCDate() + 1)
    ) {
      const day = current.toISOString().slice(0, 10);
      data.push([new Date(current), totalsByDay.get(day) ?? null]);
    }

    const dayMs = 24 * 3600 * 1000;

    return {
      aria: { enabled: true },
      animation: false,
      grid: { top: 24, right: 10, bottom: 10, left: 10 },
      xAxis: {
        type: 'time',
        show: false,
        min: startDay.getTime() - dayMs / 2,
        max: endDay.getTime() + dayMs / 2,
      },
      yAxis: { type: 'value', show: false, min: 0 },
      series: [
        {
          name: 'Pushups',
          type: 'bar',
          data,
          itemStyle: { color: 'hsl(220, 89%, 53%)' },
          label: {
            show: true,
            position: 'top',
            color: 'hsl(0, 0%, 100%)',
            fontSize: 11,
            fontWeight: 600,
            formatter: (params) => {
              const value = (params.value as [Date, number | null])[1];
              return value ? String(value) : '';
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: 'hsl(218, 11%, 65%)', type: 'dashed' },
            data: [{ yAxis: this.goal() }],
          },
        },
      ],
    };
  });

  openAddDialog(): void {
    if (this.busy()) {
      return;
    }
    const ref = this.dialog.open<
      PushupsAddDialogComponent,
      void,
      PushupsAddDialogResult
    >(PushupsAddDialogComponent, {
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((count) => {
      if (typeof count === 'number' && count > 0) {
        this.add(count);
      }
    });
  }

  private async add(count: number) {
    this.busy.set(true);
    try {
      await this.pushupsService.addSet(count);
    } finally {
      this.busy.set(false);
    }
  }
}
