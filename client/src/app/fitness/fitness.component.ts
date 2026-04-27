import { Component, inject, resource } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FitnessService } from './fitness.service';
import { MeasurementWithUnitPipe } from '../utils/measurement-with-unit.pipe';

@Component({
  standalone: true,
  imports: [MatProgressSpinnerModule, MeasurementWithUnitPipe],
  selector: 'app-fitness',
  templateUrl: './fitness.component.html',
  styleUrl: './fitness.component.css',
})
export class FitnessComponent {
  private readonly fitnessService = inject(FitnessService);

  readonly fitness = resource({
    loader: () => this.fitnessService.getFitness(),
  });
}
