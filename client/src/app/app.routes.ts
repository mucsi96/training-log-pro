import { Routes, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { MsalGuard } from '@azure/msal-angular';
import { ENVIRONMENT_CONFIG } from './environment/environment.config';
import { HomeComponent } from './home/home.component';

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
    component: HomeComponent,
    pathMatch: 'full',
    data: { period: 7 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'month',
    component: HomeComponent,
    data: { period: 30 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'year',
    component: HomeComponent,
    data: { period: 365 },
    canActivate: [conditionalAuthGuard],
  },
  {
    path: 'all-time',
    component: HomeComponent,
    canActivate: [conditionalAuthGuard],
  },
];
