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

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideTranslocoConfig(),

    provideAuthApi(),
    provideDashboardApi(),
    provideStaffApi(),
    provideBlocksApi(),

    provideStore({
      [authFeature.name]: authFeature.reducer,
      [dashboardFeature.name]: dashboardFeature.reducer,
      [staffFeature.name]: staffFeature.reducer,
      [blocksFeature.name]: blocksFeature.reducer,
    }),
    provideEffects([AuthEffects, DashboardEffects, StaffEffects, BlocksEffects]),

    provideStoreDevtools({ maxAge: 25, logOnly: false }),
  ],
};
