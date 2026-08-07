import { Provider, inject } from '@angular/core';
import { ClientsApiPort } from './clients-api.port';
import { ClientsApiService } from './clients-api.service';
import { MockClientsApiService } from './mock-clients-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideClientsApi(): Provider {
  return {
    provide: ClientsApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockClientsApiService) : inject(ClientsApiService);
    },
  };
}
