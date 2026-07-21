import { Component, computed, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
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
    MatMenuModule,
    MatTooltipModule,
    BarLoaderComponent,
    HeaderComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly stravaService = inject(StravaService);
  private readonly withingsService = inject(WithingsService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly authError = this.authService.authError;

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

  retryLogin(): void {
    this.authService.login();
  }
}
