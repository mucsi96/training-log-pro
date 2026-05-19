import { DecimalPipe } from '@angular/common';
import { Component, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { map } from 'rxjs';
import { RideService } from './ride.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';

@Component({
  standalone: true,
  imports: [DecimalPipe, MatIconModule, BarLoaderComponent, MeasurementWithUnitPipe],
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

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - minutes * 60;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  }

  formatPosition(position: number): string {
    if (position === 1) return '1st';
    if (position === 2) return '2nd';
    if (position === 3) return '3rd';
    return `${position}th`;
  }
}
