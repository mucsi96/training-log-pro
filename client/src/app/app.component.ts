import { Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { AuthService } from './auth.service';
import { StravaService } from './strava/strava.service';
import { WithingsService } from './withings/withings.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    HeaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly isAuthenticated = inject(AuthService).isAuthenticated;
  private readonly stravaService = inject(StravaService);
  private readonly withingsService = inject(WithingsService);

  readonly isReady = computed(
    () => this.stravaService.isSynced() && this.withingsService.isSynced()
  );

  constructor() {
    effect(() => {
      if (this.isAuthenticated()) {
        this.stravaService.sync();
      }
    });
  }
}
