import { Routes } from '@angular/router';
import { autoLoginPartialRoutesGuard } from 'angular-auth-oidc-client';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    pathMatch: 'full',
    data: { period: 7 },
    canActivate: [autoLoginPartialRoutesGuard],
  },
  {
    path: 'month',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    data: { period: 30 },
    canActivate: [autoLoginPartialRoutesGuard],
  },
  {
    path: 'year',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    data: { period: 365 },
    canActivate: [autoLoginPartialRoutesGuard],
  },
  {
    path: 'all-time',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [autoLoginPartialRoutesGuard],
  },
];
