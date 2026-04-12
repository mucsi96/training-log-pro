import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RouterTokens } from './app.routes';
import { BadgeComponent } from './common-components/badge/badge.component';
import { HeaderMenuComponent } from './common-components/header-menu/header-menu.component';
import { HeaderComponent } from './common-components/header/header.component';
import { HeadingComponent } from './common-components/heading/heading.component';
import { MainComponent } from './common-components/main/main.component';
import { NotificationsComponent } from './common-components/notifications/notifications.component';
import { AuthService } from './auth/auth.service';
import { combineLatest, map } from 'rxjs';
import { ButtonComponent } from './common-components/button/button.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonComponent,
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
  private readonly authService = inject(AuthService);

  readonly routerTokens = RouterTokens;
  $isSignedIn = this.authService.isSignedIn();
  $userName = this.authService.getUserName();

  $vm = combineLatest([this.$isSignedIn, this.$userName]).pipe(
    map(([isSignedIn, userName]) => ({
      isSignedIn,
      userName,
    }))
  );

  onSignin(): void {
    this.authService.signin();
  }

  onSignout(): void {
    this.authService.signout();
  }
}
