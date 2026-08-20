import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    pathMatch: 'full',
    data: { period: 30 },
    canActivate: [authGuard],
  },
  {
    path: 'year',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    data: { period: 365 },
    canActivate: [authGuard],
  },
  {
    path: 'all-time',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'devices',
    loadComponent: () =>
      import('./devices/devices.component').then((m) => m.DevicesComponent),
    canActivate: [authGuard],
  },
];
