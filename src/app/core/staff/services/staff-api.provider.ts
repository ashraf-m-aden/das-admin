import { Provider, inject } from '@angular/core';
import { StaffApiPort } from './staff-api.port';
import { StaffApiService } from './staff-api.service';
import { MockStaffApiService } from './mock-staff-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideStaffApi(): Provider {
  return {
    provide: StaffApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockStaffApiService) : inject(StaffApiService);
    },
  };
}
