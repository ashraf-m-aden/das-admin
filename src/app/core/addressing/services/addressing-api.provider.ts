import { Provider, inject } from '@angular/core';
import { AddressingApiPort } from './addressing-api.port';
import { AddressingApiService } from './addressing-api.service';
import { MockAddressingApiService } from './mock-addressing-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideAddressingApi(): Provider {
  return {
    provide: AddressingApiPort,
    useFactory: () => shouldUseMock('addressing') ? inject(MockAddressingApiService) : inject(AddressingApiService),
  };
}
