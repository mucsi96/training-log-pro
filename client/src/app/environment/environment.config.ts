import { InjectionToken } from '@angular/core';

export interface EnvironmentConfig {
  thunderforestApiKey: string;
}

export const ENVIRONMENT_CONFIG = new InjectionToken<EnvironmentConfig>('ENVIRONMENT_CONFIG');
