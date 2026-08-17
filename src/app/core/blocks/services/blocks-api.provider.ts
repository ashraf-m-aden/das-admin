import { Provider, inject } from '@angular/core';
import { BlocksApiPort } from './blocks-api.port';
import { BlocksApiService } from './blocks-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideBlocksApi(): Provider {
  return {
    provide: BlocksApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(BlocksApiService) : inject(BlocksApiService);
    },
  };
}
