import { Component } from '@angular/core';
import { RideComponent } from '../ride/ride.component';
import { WeightComponent } from '../weight/weight.component';
import { FitnessComponent } from '../fitness/fitness.component';
import { PushupsComponent } from '../pushups/pushups.component';
import { ReadingComponent } from '../reading/reading.component';
import { GoldenDayComponent } from '../golden-day/golden-day.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    GoldenDayComponent,
    RideComponent,
    WeightComponent,
    FitnessComponent,
    PushupsComponent,
    ReadingComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
