import { Component, computed, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { map } from 'rxjs';
import { WeightMeasurement, WeightService } from './weight.service';
import { AbsoluteDiffPipe } from '../utils/absolute-diff.pipe';
import { DiffColorPipe } from '../utils/diff-color.pipe';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';

type WeightDiff = {
  weight: number;
  fatMassWeight?: number;
  fatRatio?: number;
};

function computeDiff(
  initial: WeightMeasurement,
  latest: WeightMeasurement,
): WeightDiff {
  return {
    weight: latest.weight - initial.weight,
    ...(initial.fatMassWeight &&
      latest.fatMassWeight && {
        fatMassWeight: latest.fatMassWeight - initial.fatMassWeight,
      }),
    ...(initial.fatRatio &&
      latest.fatRatio && {
        fatRatio: latest.fatRatio - initial.fatRatio,
      }),
  };
}

@Component({
  standalone: true,
  imports: [
    NgxEchartsModule,
    BarLoaderComponent,
    AbsoluteDiffPipe,
    DiffColorPipe,
    MeasurementWithUnitPipe,
    DatePipe,
  ],
  selector: 'app-weight',
  templateUrl: './weight.component.html',
  styleUrl: './weight.component.css',
})
export class WeightComponent {
  private readonly weightService = inject(WeightService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };

  readonly todayHistory = resource({
    loader: () => this.weightService.getTodayWeight(),
  });

  readonly periodHistory = resource({
    params: () => this.period(),
    loader: ({ params: period }) => this.weightService.getWeight(period),
  });

  readonly latest = computed<WeightMeasurement | undefined>(() => {
    const history = this.todayHistory.value();
    return history?.measurements.at(-1) ?? history?.baseline;
  });

  readonly todayDiff = computed<WeightDiff | undefined>(() => {
    const history = this.todayHistory.value();
    const latest = history?.measurements.at(-1);
    const previous = history?.baseline;
    if (!history || !latest || !previous) {
      return undefined;
    }
    return computeDiff(previous, latest);
  });

  readonly periodDiff = computed<WeightDiff | undefined>(() => {
    const history = this.periodHistory.value();
    if (!history || history.measurements.length === 0) {
      return undefined;
    }

    const initial = history.baseline ?? history.measurements[0];
    const latest = history.measurements[history.measurements.length - 1];

    if (initial === latest) {
      return undefined;
    }

    return computeDiff(initial, latest);
  });

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const history = this.periodHistory.value();
    if (!history || history.measurements.length === 0) {
      return undefined;
    }

    const chartMeasurements: WeightMeasurement[] = history.baseline
      ? [history.baseline, ...history.measurements]
      : history.measurements;
    const minIndex = chartMeasurements.reduce(
      (index, measurement, current) =>
        measurement.weight < chartMeasurements[index].weight ? current : index,
      0,
    );
    const maxIndex = chartMeasurements.reduce(
      (index, measurement, current) =>
        measurement.weight > chartMeasurements[index].weight ? current : index,
      0,
    );
    const referenceIndices = new Set([
      0,
      chartMeasurements.length - 1,
      minIndex,
      maxIndex,
    ]);

    return {
      aria: {
        enabled: true,
      },
      animation: false,
      grid: {
        top: 24,
        right: 32,
        bottom: 24,
        left: 32,
      },
      dataset: {
        source: [
          ['date', 'weight'],
          ...chartMeasurements.map(({ date, weight }: WeightMeasurement) => [
            new Date(date),
            weight,
          ]),
        ],
      },
      xAxis: {
        type: 'time',
        show: false,
      },
      yAxis: {
        max: 'dataMax',
        min: 'dataMin',
        show: false,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbolSize: (_value, params) => referenceIndices.has(params.dataIndex) ? 5 : 0,
          label: {
            show: true,
            color: '#ddd',
            fontSize: 11,
            formatter: (params) => referenceIndices.has(params.dataIndex)
              ? `${chartMeasurements[params.dataIndex].weight} kg`
              : '',
          },
          labelLayout: {
            moveOverlap: 'shiftY',
          },
        },
      ],
    };
  });
}
