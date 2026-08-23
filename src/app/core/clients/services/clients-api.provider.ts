import { Provider, inject } from '@angular/core';
import { ClientsApiPort } from './clients-api.port';
import { ClientsApiService } from './clients-api.service';
import { MockClientsApiService } from './mock-clients-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideClientsApi(): Provider {
  return {
    provide: ClientsApiPort,
    useFactory: () => shouldUseMock('clients') ? inject(MockClientsApiService) : inject(ClientsApiService),
  };
}
