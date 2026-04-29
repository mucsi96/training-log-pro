import { Component, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map } from 'rxjs';
import { RideService } from './ride.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';

@Component({
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, MeasurementWithUnitPipe],
  selector: 'app-ride',
  templateUrl: './ride.component.html',
  styleUrl: './ride.component.css',
})
export class RideComponent {
  private readonly rideService = inject(RideService);
  private readonly period = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['period'] as number) ?? 0))
  );

  readonly todayRideStats = resource({
    loader: () => this.rideService.getRideStats(1),
  });

  readonly periodRideStats = resource({
    params: () => this.period(),
    loader: ({ params: period }) => this.rideService.getRideStats(period),
  });

  readonly podiumMessage = resource({
    loader: () => this.rideService.getPodiumMessage(),
  });
}
