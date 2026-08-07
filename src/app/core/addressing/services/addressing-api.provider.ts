import { Provider, inject } from '@angular/core';
import { AddressingApiPort } from './addressing-api.port';
import { AddressingApiService } from './addressing-api.service';
import { MockAddressingApiService } from './mock-addressing-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideAddressingApi(): Provider {
  return {
    provide: AddressingApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockAddressingApiService) : inject(AddressingApiService);
    },
  };
}
