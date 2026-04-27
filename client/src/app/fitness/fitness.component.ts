import { Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map } from 'rxjs';
import { FitnessMeasurement, FitnessService } from './fitness.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';
import { RelativeTimePipe } from '../utils/relative-time.pipe';

@Component({
  standalone: true,
  imports: [
    NgxEchartsModule,
    MatProgressSpinnerModule,
    MeasurementWithUnitPipe,
    RelativeTimePipe,
  ],
  selector: 'app-fitness',
  templateUrl: './fitness.component.html',
  styleUrl: './fitness.component.css',
})
export class FitnessComponent {
  private readonly fitnessService = inject(FitnessService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };

  readonly todayFitness = resource({
    loader: () => this.fitnessService.getFitness(1),
  });

  readonly periodFitness = resource({
    params: () => this.period(),
    loader: ({ params: period }) => this.fitnessService.getFitness(period),
  });

  readonly latest = computed<FitnessMeasurement | undefined>(() => {
    const today = this.todayFitness.value();
    return today?.measurements.at(-1);
  });

  readonly pulledAt = computed<Date | undefined>(
    () => this.todayFitness.value()?.pulledAt
  );

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const timeline = this.periodFitness.value();
    if (!timeline) {
      return undefined;
    }

    const measurements = timeline.measurements;

    return {
      aria: {
        enabled: true,
      },
      animation: false,
      grid: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: 'time',
        show: false,
      },
      yAxis: {
        type: 'value',
        show: false,
      },
      series: [
        {
          name: 'Fitness',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: measurements.map((m) => [m.date, m.fitness]),
        },
        {
          name: 'Fatigue',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: measurements.map((m) => [m.date, m.fatigue]),
        },
        {
          name: 'Form',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: measurements.map((m) => [m.date, m.form]),
        },
      ],
    };
  });
}
