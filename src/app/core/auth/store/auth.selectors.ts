import { createSelector } from '@ngrx/store';
import { authFeature } from './auth.reducer';

export const selectIsAuthenticated = createSelector(authFeature.selectStatus, (status) => status === 'authenticated');

export const selectIsAuthLoading = createSelector(
  authFeature.selectStatus,
  (status) => status === 'authenticating' || status === 'restoring',
);

export const selectUserRole = createSelector(authFeature.selectUser, (user) => user?.role ?? null);

export const selectUserFullName = createSelector(authFeature.selectUser, (user) =>
  user ? `${user.firstName} ${user.lastName}` : null,
);
