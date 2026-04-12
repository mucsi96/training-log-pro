import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NgxEchartsModule } from 'ngx-echarts';
import { combineLatest, map, switchMap } from 'rxjs';
import { HeadingComponent } from '../common-components/heading/heading.component';
import { TextComponent } from '../common-components/text/text.component';
import { RideService } from './ride.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    HeadingComponent,
    NgxEchartsModule,
    TextComponent,
    MeasurementWithUnitPipe,
  ],
  selector: 'app-ride',
  templateUrl: './ride.component.html',
  styleUrls: ['./ride.component.css'],
})
export class RideComponent {
  private readonly rideService = inject(RideService);
  private readonly route = inject(ActivatedRoute);

  private readonly $periodRideStats = this.route.data.pipe(
    switchMap((data) => this.rideService.getRideStats(data['period']))
  );
  private readonly $todayRideStats = this.rideService.getRideStats(1);

  $vm = combineLatest([this.$todayRideStats, this.$periodRideStats]).pipe(
    map(([todayRideStats, periodRideStats]) => ({
      todayRideStats,
      periodRideStats,
    }))
  );
}
