import { Provider, inject } from '@angular/core';
import { SettingsApiPort } from './settings-api.port';
import { SettingsApiService } from './settings-api.service';
import { MockSettingsApiService } from './mock-settings-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideSettingsApi(): Provider {
  return {
    provide: SettingsApiPort,
    useFactory: () => shouldUseMock('settings') ? inject(MockSettingsApiService) : inject(SettingsApiService),
  };
}
