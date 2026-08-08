import { createSelector } from '@ngrx/store';
import { authFeature } from './auth.reducer';
import { UserRole } from '../../models/das.models';

export const selectIsAuthenticated = createSelector(authFeature.selectStatus, (status) => status === 'authenticated');

export const selectIsAuthLoading = createSelector(
  authFeature.selectStatus,
  (status) => status === 'authenticating' || status === 'restoring',
);

export const selectUserRoles = createSelector(authFeature.selectUser, (user): UserRole[] => user?.roles ?? []);
