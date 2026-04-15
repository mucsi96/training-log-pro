import { Routes, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { MsalGuard } from '@azure/msal-angular';
import { ENVIRONMENT_CONFIG } from './environment/environment.config';

const conditionalAuthGuard: CanActivateFn = (route, state) => {
  const { mockAuth } = inject(ENVIRONMENT_CONFIG);

  if (mockAuth) {
    return true;
  }

  const msalGuard = inject(MsalGuard);
  return msalGuard.canActivate(route, state);
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    pathMatch: 'full',
    data: { period: 7 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'month',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    data: { period: 30 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'year',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    data: { period: 365 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'all-time',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [conditionalAuthGuard],
  },
];
