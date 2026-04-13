import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderMenuComponent } from './common-components/header-menu/header-menu.component';
import { HeaderComponent } from './common-components/header/header.component';
import { HeadingComponent } from './common-components/heading/heading.component';
import { MainComponent } from './common-components/main/main.component';
import { NotificationsComponent } from './common-components/notifications/notifications.component';
import { AuthService } from './auth.service';
import { UserBadgeComponent } from './user-badge/user-badge.component';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    HeadingComponent,
    HeaderComponent,
    HeaderMenuComponent,
    MainComponent,
    NotificationsComponent,
    UserBadgeComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  readonly isAuthenticated = inject(AuthService).isAuthenticated;
}
