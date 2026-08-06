import { DashboardSummary } from '../models/dashboard.models';

export type DashboardStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface DashboardState {
  summary: DashboardSummary | null;
  status: DashboardStatus;
  errorMessageKey: string | null;
}

export const initialDashboardState: DashboardState = {
  summary: null,
  status: 'idle',
  errorMessageKey: null,
};
