import { Provider, inject } from '@angular/core';
import { NotificationsApiPort } from './notifications-api.port';
import { NotificationsApiService } from './notifications-api.service';
import { MockNotificationsApiService } from './mock-notifications-api.service';
import { AppConfigService } from '../../config/app-config.service';

export function provideNotificationsApi(): Provider {
  return {
    provide: NotificationsApiPort,
    useFactory: () => {
      const useMock = inject(AppConfigService).get('useMockApi');
      return useMock ? inject(MockNotificationsApiService) : inject(NotificationsApiService);
    },
  };
}
