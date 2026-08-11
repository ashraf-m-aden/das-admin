import { createSelector } from '@ngrx/store';
import { dashboardFeature } from './dashboard.reducer';

export const selectIsDashboardLoading = createSelector(
  dashboardFeature.selectStatus,
  (status) => status === 'loading',
);
