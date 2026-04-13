import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { UserProfileService } from '../user-profile.service';

@Component({
  standalone: true,
  imports: [MatButtonModule, MatMenuModule],
  selector: 'app-user-badge',
  templateUrl: './user-badge.component.html',
  styleUrl: './user-badge.component.css',
})
export class UserBadgeComponent {
  readonly profile = inject(UserProfileService).profile;
}
