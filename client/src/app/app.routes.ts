import { Routes } from '@angular/router';
import { authGuard } from './utils/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    pathMatch: 'full',
    data: { period: 7 },
    canActivate: [authGuard],
  },
  {
    path: 'month',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
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
    path: 'learning',
    loadComponent: () =>
      import('./learning/learning.component').then((m) => m.LearningComponent),
    pathMatch: 'full',
    canActivate: [authGuard],
  },
  {
    path: 'learning/:id',
    loadComponent: () =>
      import('./learning/learning-path.component').then(
        (m) => m.LearningPathComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
  },
];
