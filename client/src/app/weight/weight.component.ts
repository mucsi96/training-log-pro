import { Component, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NotificationService } from '../common-components/notification.service';
import {
  HttpRequestState,
  initialHttpRequestState,
  requestState,
} from '../utils/request-state';
import { WeightMeasurement, WeightService } from '../weight.service';
import { NgxEchartsDirective } from 'ngx-echarts';

type Period = {
  label: string;
  value: number;
};

@Component({
  selector: 'app-weight',
  templateUrl: './weight.component.html',
  styleUrls: ['./weight.component.css'],
})
export class WeightComponent implements OnInit {
  initOpts: NgxEchartsDirective['initOpts'] = {
    renderer: 'svg',
  };
  periods: Period[] = [
    { label: 'Week', value: 7 },
    { label: 'Month', value: 30 },
    { label: 'Year', value: 365 },
    { label: 'All time', value: 0 },
  ];
  selectedPeriod = this.periods[0];

  constructor(
    private weightService: WeightService,
    private notificationService: NotificationService
  ) {}

  weightState: HttpRequestState<WeightMeasurement[]> = initialHttpRequestState;

  ngOnInit(): void {
    requestState(this.weightService.getWeight(), (newState) => {
      this.weightState = newState;

      if (newState.hasFailed) {
        this.notificationService.showNotification(
          'Unable to fetch weight',
          'error'
        );
      }
    });
  }

  selectPeriod(newPeriod: Period) {
    this.selectedPeriod = newPeriod;
  }

  get chartOptions(): EChartsOption | null {
    if (!this.weightState.isReady) {
      return null;
    }

    const today = new Date(this.weightState.value.slice(-1)[0].date);
    const cutDate =
      today.getTime() - this.selectedPeriod.value * 1000 * 60 * 60 * 24;

    return {
      animation: false,
      grid: {
        top: 10,
        right: 0,
        bottom: 40,
        left: 40,
      },
      dataset: {
        source: [
          ['date', 'weight'],
          ...this.weightState.value
            .filter(
              ({ date }) =>
                !this.selectedPeriod.value || new Date(date).getTime() >= cutDate
            )
            .map(({ date, weight }) => [new Date(date), weight]),
        ],
      },
      xAxis: {
        type: 'time',
      },
      yAxis: {
        max: 'dataMax',
        min: 'dataMin',
      },
      series: [
        {
          type: 'line',
          smooth: true,
        },
      ],
    };
  }
}
