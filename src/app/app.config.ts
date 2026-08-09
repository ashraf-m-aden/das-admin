import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { provideTranslocoConfig } from './core/i18n/transloco.config';
import { provideAuthApi } from './core/auth/services/auth-api.provider';
import { authFeature } from './core/auth/store/auth.reducer';
import { AuthEffects } from './core/auth/store/auth.effects';
import { authInterceptor } from './core/auth/interceptors/auth.interceptor';
import { provideDashboardApi } from './core/dashboard/services/dashboard-api.provider';
import { dashboardFeature } from './core/dashboard/store/dashboard.reducer';
import { DashboardEffects } from './core/dashboard/store/dashboard.effects';
import { provideStaffApi } from './core/staff/services/staff-api.provider';
import { staffFeature } from './core/staff/store/staff.reducer';
import { StaffEffects } from './core/staff/store/staff.effects';
import { provideBlocksApi } from './core/blocks/services/blocks-api.provider';
import { blocksFeature } from './core/blocks/store/blocks.reducer';
import { BlocksEffects } from './core/blocks/store/blocks.effects';
import { provideReviewApi } from './core/review/services/review-api.provider';
import { reviewFeature } from './core/review/store/review.reducer';
import { ReviewEffects } from './core/review/store/review.effects';
import { provideNotificationsApi } from './core/notifications/services/notifications-api.provider';
import { notificationsFeature } from './core/notifications/store/notifications.reducer';
import { NotificationsEffects } from './core/notifications/store/notifications.effects';
import { provideSettingsApi } from './core/settings/services/settings-api.provider';
import { settingsFeature } from './core/settings/store/settings.reducer';
import { SettingsEffects } from './core/settings/store/settings.effects';
import { provideAddressingApi } from './core/addressing/services/addressing-api.provider';
import { addressingFeature } from './core/addressing/store/addressing.reducer';
import { AddressingEffects } from './core/addressing/store/addressing.effects';
import { provideClientsApi } from './core/clients/services/clients-api.provider';
import { clientsFeature } from './core/clients/store/clients.reducer';
import { ClientsEffects } from './core/clients/store/clients.effects';
import { FeedbackEffects } from './core/ui/feedback.effects';
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideTranslocoConfig(),

    provideAuthApi(),
    provideDashboardApi(),
    provideStaffApi(),
    provideBlocksApi(),
    provideReviewApi(),
    provideNotificationsApi(),
    provideSettingsApi(),
    provideAddressingApi(),
    provideClientsApi(),

    provideStore({
      [authFeature.name]: authFeature.reducer,
      [dashboardFeature.name]: dashboardFeature.reducer,
      [staffFeature.name]: staffFeature.reducer,
      [blocksFeature.name]: blocksFeature.reducer,
      [reviewFeature.name]: reviewFeature.reducer,
      [notificationsFeature.name]: notificationsFeature.reducer,
      [settingsFeature.name]: settingsFeature.reducer,
      [addressingFeature.name]: addressingFeature.reducer,
      [clientsFeature.name]: clientsFeature.reducer,
    }),
    provideEffects([
      AuthEffects,
      DashboardEffects,
      StaffEffects,
      BlocksEffects,
      ReviewEffects,
      NotificationsEffects,
      SettingsEffects,
      AddressingEffects,
      ClientsEffects,
      FeedbackEffects
    ]),

    provideStoreDevtools({ maxAge: 25, logOnly: false }),
  ],
};
