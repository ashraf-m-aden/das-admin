import { Provider } from '@angular/core';
import { DashboardApiPort } from './dashboard-api.port';
import { DashboardApiService } from './dashboard-api.service';

/**
 * Pas de bascule mock/réel ici : `DashboardApiService` ne fait que composer `AdresseApiPort`
 * et `FieldOpsApiPort`, qui basculent déjà chacun individuellement selon `useMockApi()`.
 */
export function provideDashboardApi(): Provider {
  return { provide: DashboardApiPort, useClass: DashboardApiService };
}
