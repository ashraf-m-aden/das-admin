import { Provider, inject } from '@angular/core';
import { NotificationsApiPort } from './notifications-api.port';
import { NotificationsApiService } from './notifications-api.service';
import { MockNotificationsApiService } from './mock-notifications-api.service';
import { shouldUseMock } from '../../config/backend-readiness';

export function provideNotificationsApi(): Provider {
  return {
    provide: NotificationsApiPort,
    useFactory: () => shouldUseMock('notifications') ? inject(MockNotificationsApiService) : inject(NotificationsApiService),
  };
}
