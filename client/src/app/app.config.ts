import {
  ApplicationConfig,
  inject,
  Provider,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAngularMaterialTheme } from '@mucsi96/angular-material-theme';
import * as echarts from 'echarts';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { routes } from './app.routes';
import { errorInterceptor } from './utils/error.interceptor';
import { authRetryInterceptor } from './utils/auth-retry.interceptor';
import { timezoneInterceptor } from './utils/timezone.interceptor';
import { tokenInterceptor } from './utils/token.interceptor';
import { AuthService } from './auth.service';
import { provideOidcAuth } from './auth.config';
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
      provideRouter(routes),
      provideHttpClient(
        withInterceptors([
          errorInterceptor,
          authRetryInterceptor,
          tokenInterceptor,
          timezoneInterceptor,
        ])
      ),
      { provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig },
      provideAnimationsAsync(),
      provideAngularMaterialTheme(),
      { provide: ENVIRONMENT_CONFIG, useValue: environment },
      provideECharts(),
      provideOidcAuth(environment),
      provideAppInitializer(() => inject(AuthService).init()),
    ],
  };
}
