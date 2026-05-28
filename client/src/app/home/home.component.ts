import { Component } from '@angular/core';
import { RideComponent } from '../ride/ride.component';
import { WeightComponent } from '../weight/weight.component';
import { FitnessComponent } from '../fitness/fitness.component';
import { FtpComponent } from '../ftp/ftp.component';
import { PushupsComponent } from '../pushups/pushups.component';
import { ReadingComponent } from '../reading/reading.component';
import { GoldenDayComponent } from '../golden-day/golden-day.component';
import { DailyTasksComponent } from '../daily-tasks/daily-tasks.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    GoldenDayComponent,
    DailyTasksComponent,
    RideComponent,
    WeightComponent,
    FitnessComponent,
    FtpComponent,
    PushupsComponent,
    ReadingComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
