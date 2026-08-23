import { Provider, inject } from '@angular/core';
import { BlocksApiPort } from './blocks-api.port';
import { BlocksApiService } from './blocks-api.service';
import { MockBlocksApiService } from './mock-blocks-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideBlocksApi(): Provider {
  return {
    provide: BlocksApiPort,
    useFactory: () => shouldUseMock('blocks') ? inject(MockBlocksApiService) : inject(BlocksApiService),
  };
}
