import { Provider, inject } from '@angular/core';
import { SettingsApiPort } from './settings-api.port';
import { SettingsApiService } from './settings-api.service';
import { MockSettingsApiService } from './mock-settings-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideSettingsApi(): Provider {
  return {
    provide: SettingsApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockSettingsApiService) : inject(SettingsApiService);
    },
  };
}
