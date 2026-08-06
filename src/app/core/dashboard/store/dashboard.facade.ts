import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DashboardActions } from './dashboard.actions';
import { dashboardFeature } from './dashboard.reducer';
import { selectIsDashboardLoading, selectUrgentAlerts, selectZoneProgress } from './dashboard.selectors';

@Injectable({ providedIn: 'root' })
export class DashboardFacade {
  private store = inject(Store);

  summary$ = this.store.select(dashboardFeature.selectSummary);
  zoneProgress$ = this.store.select(selectZoneProgress);
  urgentAlerts$ = this.store.select(selectUrgentAlerts);
  isLoading$ = this.store.select(selectIsDashboardLoading);
  errorMessageKey$ = this.store.select(dashboardFeature.selectErrorMessageKey);

  loadSummary(): void {
    this.store.dispatch(DashboardActions.loadSummary());
  }
}
