import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject } from '@angular/core';
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
import { DataQualityApiPort } from './core/dataquality/services/dataquality-api.port';
import { MockDataQualityApiService } from './core/dataquality/services/mock-dataquality-api.service';
import { FieldOpsApiPort } from './core/fieldops/services/fieldops-api.port';
import { MockFieldOpsApiService } from './core/fieldops/services/mock-fieldops-api.service';
import { fieldOpsFeature } from './core/fieldops/store/fieldops.reducer';
import { FieldOpsEffects } from './core/fieldops/store/fieldops.effects';
import { MockPostcodesApiService } from './core/postcodes/services/mock-postcodes-api.service';
import { PostcodesApiPort } from './core/postcodes/services/postcodes-api.port';
import { MockAdresseApiService } from './core/adresse/services/mock-adresse-api.service';
import { AdresseApiPort } from './core/adresse/services/adresse-api.port';
import { AdresseApiService } from './core/adresse/services/adresse-api.service';
import { MockReportsApiService } from './core/reports/services/mock-reports-api.service';
import { ReportsApiPort } from './core/reports/services/reports-api.port';
import { IntegrationsApiPort } from './core/integrations/services/integrations-api.port';
import { MockIntegrationsApiService } from './core/integrations/services/mock-integrations-api.service';
import { MockAuditApiService } from './core/audit/services/mock-audit-api.service';
import { AuditApiPort } from './core/audit/services/audit-api.port';
import { ThemeService } from './core/theme/theme.service';
import { PostcodesApiService } from './core/postcodes/services/postcodes-api.service';
import { DataQualityApiService } from './core/dataquality/services/dataquality-api.service';
import { FieldOpsApiService } from './core/fieldops/services/fieldops-api.service';
import { ReportsApiService } from './core/reports/services/reports-api.service';
import { AuditApiService } from './core/audit/services/audit-api.service';
import { IntegrationsApiService } from './core/integrations/services/integrations-api.service';
import { HierarchyMockService } from './core/hierarchy/services/hierarchy-api.mock';
import { HierarchyApiPort } from './core/hierarchy/services/hierarchy-api.port';
import { HierarchyApiService } from './core/hierarchy/services/hierarchy-api.service';
import { ReferenceApiPort } from './core/reference/services/reference-api.port';
import { ReferenceApiService } from './core/reference/services/reference-api.service';
import { MockReferenceApiService } from './core/reference/services/mock-reference-api.service';
import { UnitsApiPort } from './core/units/services/units-api.port';
import { UnitsApiService } from './core/units/services/units-api.service';
import { MockUnitsApiService } from './core/units/services/mock-units-api.service';
import { ClosesApiPort } from './core/closes/services/closes-api.port';
import { ClosesApiService } from './core/closes/services/closes-api.service';
import { MockClosesApiService } from './core/closes/services/mock-closes-api.service';
import { shouldUseMock } from './core/config/backend-readiness';
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
      [fieldOpsFeature.name]: fieldOpsFeature.reducer,
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
      FieldOpsEffects,
      NotificationsEffects,
      SettingsEffects,
      AddressingEffects,
      ClientsEffects,
      FeedbackEffects
    ]),
    { provide: PostcodesApiPort, useFactory: () => shouldUseMock('postcodes') ? inject(MockPostcodesApiService) : inject(PostcodesApiService) },
    {
      provide: HierarchyApiPort,
      useFactory: () => shouldUseMock('hierarchy') ? inject(HierarchyMockService) : inject(HierarchyApiService),
    },
    { provide: FieldOpsApiPort, useFactory: () => shouldUseMock('fieldops') ? inject(MockFieldOpsApiService) : inject(FieldOpsApiService) },
    { provide: DataQualityApiPort, useFactory: () => shouldUseMock('dataquality') ? inject(MockDataQualityApiService) : inject(DataQualityApiService) },
    { provide: ReportsApiPort, useFactory: () => shouldUseMock('reports') ? inject(MockReportsApiService) : inject(ReportsApiService) },
    { provide: IntegrationsApiPort, useFactory: () => shouldUseMock('integrations') ? inject(MockIntegrationsApiService) : inject(IntegrationsApiService) },
    { provide: AuditApiPort, useFactory: () => shouldUseMock('audit') ? inject(MockAuditApiService) : inject(AuditApiService) },
    {
      provide: AdresseApiPort,
      useFactory: () => (shouldUseMock('adresse') ? inject(MockAdresseApiService) : inject(AdresseApiService)),
    },
    { provide: ReferenceApiPort, useFactory: () => shouldUseMock('reference') ? inject(MockReferenceApiService) : inject(ReferenceApiService) },
    { provide: UnitsApiPort, useFactory: () => shouldUseMock('units') ? inject(MockUnitsApiService) : inject(UnitsApiService) },
    { provide: ClosesApiPort, useFactory: () => shouldUseMock('closes') ? inject(MockClosesApiService) : inject(ClosesApiService) },

    { provide: ENVIRONMENT_INITIALIZER, multi: true, useValue: () => inject(ThemeService) },
    provideStoreDevtools({ maxAge: 25, logOnly: false }),
  ],
};
