import { createSelector } from '@ngrx/store';
import { dashboardFeature } from './dashboard.reducer';

export const selectIsDashboardLoading = createSelector(
  dashboardFeature.selectStatus,
  (status) => status === 'loading',
);

export const selectZoneProgress = createSelector(
  dashboardFeature.selectSummary,
  (summary) => summary?.zoneProgress ?? [],
);

export const selectUrgentAlerts = createSelector(
  dashboardFeature.selectSummary,
  (summary) => summary?.urgentAlerts ?? [],
);
