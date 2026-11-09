import { Injectable, inject, linkedSignal } from '@angular/core';
import { AuthService } from './auth.service';

interface UserProfile {
  name: string;
  initials: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserProfileService {
  private readonly authService = inject(AuthService);

  // Keep last profile while userData is briefly empty during iOS PWA token renewal.
  profile = linkedSignal<unknown, UserProfile | undefined>({
    source: this.authService.userData,
    computation: (profile, previous) => {
      const claims = profile as
        | { name?: string; preferred_username?: string }
        | null
        | undefined;
      const name = claims?.name ?? claims?.preferred_username;

      if (!name) {
        return previous?.value;
      }

      return {
        name,
        initials: this.getInitials(name),
      };
    },
  });

  private getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
}
