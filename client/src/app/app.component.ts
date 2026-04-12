import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BadgeComponent } from './common-components/badge/badge.component';
import { HeaderMenuComponent } from './common-components/header-menu/header-menu.component';
import { HeaderComponent } from './common-components/header/header.component';
import { HeadingComponent } from './common-components/heading/heading.component';
import { MainComponent } from './common-components/main/main.component';
import { NotificationsComponent } from './common-components/notifications/notifications.component';
import { AuthService } from './auth.service';
import { UserProfileService } from './user-profile.service';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    HeadingComponent,
    HeaderComponent,
    HeaderMenuComponent,
    MainComponent,
    BadgeComponent,
    NotificationsComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  readonly isAuthenticated = inject(AuthService).isAuthenticated;
  readonly profile = inject(UserProfileService).profile;
}
