import { Component } from '@angular/core';
import { RideComponent } from '../ride/ride.component';
import { WeightComponent } from '../weight/weight.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RideComponent, WeightComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
