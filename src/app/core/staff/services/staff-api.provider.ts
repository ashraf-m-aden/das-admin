import { Provider, inject } from '@angular/core';
import { StaffApiPort } from './staff-api.port';
import { StaffApiService } from './staff-api.service';
import { MockStaffApiService } from './mock-staff-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideStaffApi(): Provider {
  return {
    provide: StaffApiPort,
    useFactory: () => shouldUseMock('staff') ? inject(MockStaffApiService) : inject(StaffApiService),
  };
}
