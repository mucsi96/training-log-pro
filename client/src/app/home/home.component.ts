import { Component } from '@angular/core';
import { RideComponent } from '../ride/ride.component';
import { WeightComponent } from '../weight/weight.component';
import { FitnessComponent } from '../fitness/fitness.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RideComponent, WeightComponent, FitnessComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
