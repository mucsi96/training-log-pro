import { Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';
import { map } from 'rxjs';
import { HeadingComponent } from '../common-components/heading/heading.component';
import { TextComponent } from '../common-components/text/text.component';
import { WeightMeasurement, WeightService } from './weight.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';
import { PercentageDiffColorPipe } from '../utils/percentage-diff-color.pipe';
import { PercentageDiffPipe } from '../utils/percentage-diff.pipe';

@Component({
  standalone: true,
  imports: [
    HeadingComponent,
    NgxEchartsModule,
    TextComponent,
    PercentageDiffPipe,
    PercentageDiffColorPipe,
    MeasurementWithUnitPipe,
  ],
  selector: 'app-weight',
  templateUrl: './weight.component.html',
  styleUrls: ['./weight.component.css'],
})
export class WeightComponent {
  private readonly weightService = inject(WeightService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly initOpts = { renderer: 'svg' as const };

  readonly todayWeight = resource({
    loader: () => this.weightService.getTodayWeight(),
  });

  readonly periodMeasurements = resource({
    params: () => this.period(),
    loader: ({ params: period }) => this.weightService.getWeight(period),
  });

  readonly diff = computed(() => {
    const measurements = this.periodMeasurements.value();
    if (!measurements || measurements.length < 2) {
      return undefined;
    }

    const initial = measurements[0];
    const latest = measurements[measurements.length - 1];

    return {
      date: latest.date,
      weight: (latest.weight - initial.weight) / initial.weight,
      ...(initial.fatMassWeight &&
        latest.fatMassWeight && {
          fatMassWeight:
            (latest.fatMassWeight - initial.fatMassWeight) /
            initial.fatMassWeight,
        }),
      ...(initial.fatRatio &&
        latest.fatRatio && {
          fatRatio: (latest.fatRatio - initial.fatRatio) / initial.fatRatio,
        }),
    };
  });

  readonly chartOptions = computed<EChartsOption | undefined>(() => {
    const measurements = this.periodMeasurements.value();
    if (!measurements) {
      return undefined;
    }

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
      dataset: {
        source: [
          ['date', 'weight'],
          ...measurements.map(({ date, weight }: WeightMeasurement) => [
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
          showSymbol: false,
        },
      ],
    };
  });
}
