import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { RideComponent } from '../ride/ride.component';
import { WeightComponent } from '../weight/weight.component';
import { FitnessComponent } from '../fitness/fitness.component';
import { FtpComponent } from '../ftp/ftp.component';
import { PushupsComponent } from '../pushups/pushups.component';
import { ReadingComponent } from '../reading/reading.component';
import { DayGoalComponent } from '../day-goal/day-goal.component';
import { DailyTasksComponent } from '../daily-tasks/daily-tasks.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    MatTabsModule,
    MatIconModule,
    DayGoalComponent,
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
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly selectedIndex = computed(() => {
    const view = this.queryParams().get('view');
    return view === 'training' ? 1 : view === 'health' ? 2 : 0;
  });

  selectView(index: number) {
    if (index === this.selectedIndex()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: index === 1 ? 'training' : index === 2 ? 'health' : null },
      queryParamsHandling: 'merge',
    });
  }
}
