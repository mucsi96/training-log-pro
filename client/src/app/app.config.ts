import {
  ApplicationConfig,
  inject,
  Provider,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import {
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import {
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material/core';
import { provideAngularMaterialTheme } from '@mucsi96/angular-material-theme';
import * as echarts from 'echarts';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { routes } from './app.routes';
import { errorInterceptor } from './utils/error.interceptor';
import { authRetryInterceptor } from './utils/auth-retry.interceptor';
import { timezoneInterceptor } from './utils/timezone.interceptor';
import { AuthService } from './auth.service';
import {
  EnvironmentConfig,
  ENVIRONMENT_CONFIG,
} from './environment/environment.config';

const globalRippleConfig: RippleGlobalOptions = {
  disabled: true,
};

function provideECharts(): Provider {
  return {
    provide: NGX_ECHARTS_CONFIG,
    useFactory: () => ({ echarts }),
  };
}

export function getAppConfig(environment: EnvironmentConfig): ApplicationConfig {
  return {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(
        withXsrfConfiguration({ cookieName: window.location.protocol === 'https:' ? '__Host-XSRF-TOKEN' : 'XSRF-TOKEN' }),
        withInterceptors([
          errorInterceptor,
          authRetryInterceptor,
          timezoneInterceptor,
        ])
      ),
      { provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig },
      provideAngularMaterialTheme(),
      { provide: ENVIRONMENT_CONFIG, useValue: environment },
      provideECharts(),
      provideAppInitializer(() => inject(AuthService).init()),
    ],
  };
}
