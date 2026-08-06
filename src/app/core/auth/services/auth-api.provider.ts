import { Provider, inject } from '@angular/core';
import { AuthApiPort } from './auth-api.port';
import { AuthApiService } from './auth-api.service';
import { MockAuthApiService } from './mock-auth-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideAuthApi(): Provider {
  return {
    provide: AuthApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockAuthApiService) : inject(AuthApiService);
    },
  };
}
