import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthActions } from './auth.actions';
import { initialAuthState } from './auth.state';

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialAuthState,

    on(AuthActions.login, (state) => ({ ...state, status: 'authenticating' as const, errorMessageKey: null })),

    on(AuthActions.loginSuccess, AuthActions.restoreSessionSuccess, (state, { response }) => ({
      ...state,
      user: response.user,
      accessToken: response.tokens.accessToken,
      refreshToken: response.tokens.refreshToken,
      expiresAt: response.tokens.expiresAt,
      status: 'authenticated' as const,
      errorMessageKey: null,
    })),

    on(AuthActions.loginFailure, (state, { errorMessageKey }) => ({
      ...state,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      status: 'error' as const,
      errorMessageKey,
    })),

    on(AuthActions.restoreSession, (state) => ({ ...state, status: 'restoring' as const })),

    on(AuthActions.restoreSessionFailure, AuthActions.logoutComplete, () => initialAuthState),
  ),
});

export const {
  name: authFeatureKey,
  reducer: authReducer,
  selectUser,
  selectAccessToken,
  selectStatus,
  selectErrorMessageKey,
} = authFeature;
