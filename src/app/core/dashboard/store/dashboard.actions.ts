import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { DashboardSummary } from '../models/dashboard.models';

export const DashboardActions = createActionGroup({
  source: 'Dashboard',
  events: {
    'Load Summary': emptyProps(),
    'Load Summary Success': props<{ summary: DashboardSummary }>(),
    'Load Summary Failure': props<{ errorMessageKey: string }>(),
  },
});
