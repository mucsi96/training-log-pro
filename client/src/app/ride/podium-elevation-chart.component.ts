import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EChartsOption } from 'echarts';
import { NgxEchartsModule } from 'ngx-echarts';

@Component({
  standalone: true,
  imports: [NgxEchartsModule],
  selector: 'app-podium-elevation-chart',
  templateUrl: './podium-elevation-chart.component.html',
  styleUrl: './podium-elevation-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PodiumElevationChartComponent {
  readonly distances = input.required<number[]>();
  readonly altitudes = input.required<number[]>();

  readonly initOpts = { renderer: 'svg' as const };

  readonly options = computed<EChartsOption>(() => {
    const d = this.distances();
    const a = this.altitudes();
    const data = d.map((dist, i) => [dist / 1000, a[i]]);

    return {
      animation: false,
      grid: { top: 8, right: 8, bottom: 8, left: 8 },
      xAxis: { type: 'value', show: false, min: 'dataMin', max: 'dataMax' },
      yAxis: { type: 'value', show: false, scale: true },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          data,
          lineStyle: { color: '#ffd700', width: 2 },
          areaStyle: { color: 'rgba(255, 215, 0, 0.18)' },
        },
      ],
    };
  });
}
