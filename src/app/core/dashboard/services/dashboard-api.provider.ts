import { Provider, inject } from '@angular/core';
import { DashboardApiPort } from './dashboard-api.port';
import { DashboardApiService } from './dashboard-api.service';
import { MockDashboardApiService } from './mock-dashboard-api.service';
import { AppConfigService } from '../../config/app-config.service';

/** Même bascule mock/réel que provideAuthApi(), pilotée par config.useMockApi. */
export function provideDashboardApi(): Provider {
  return {
    provide: DashboardApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockDashboardApiService) : inject(DashboardApiService);
    },
  };
}
