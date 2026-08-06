import { createFeature, createReducer, on } from '@ngrx/store';
import { DashboardActions } from './dashboard.actions';
import { initialDashboardState } from './dashboard.state';

export const dashboardFeature = createFeature({
  name: 'dashboard',
  reducer: createReducer(
    initialDashboardState,

    on(DashboardActions.loadSummary, (state) => ({
      ...state,
      status: 'loading' as const,
      errorMessageKey: null,
    })),

    on(DashboardActions.loadSummarySuccess, (state, { summary }) => ({
      ...state,
      summary,
      status: 'loaded' as const,
      errorMessageKey: null,
    })),

    on(DashboardActions.loadSummaryFailure, (state, { errorMessageKey }) => ({
      ...state,
      status: 'error' as const,
      errorMessageKey,
    })),
  ),
});

export const {
  name: dashboardFeatureKey,
  reducer: dashboardReducer,
  selectSummary,
  selectStatus,
  selectErrorMessageKey,
} = dashboardFeature;
