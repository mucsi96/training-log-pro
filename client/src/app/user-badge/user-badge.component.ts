import { Component, inject } from '@angular/core';
import { BadgeComponent } from '../common-components/badge/badge.component';
import { UserProfileService } from '../user-profile.service';

@Component({
  standalone: true,
  imports: [BadgeComponent],
  selector: 'app-user-badge',
  template: `@if (profile.value(); as user) {
    <span app-badge>{{ user.name }}</span>
  }`,
})
export class UserBadgeComponent {
  readonly profile = inject(UserProfileService).profile;
}
