import { AuthenticatedUser } from '../models/auth.models';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'error';

export interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  status: AuthStatus;
  errorMessageKey: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  status: 'idle',
  errorMessageKey: null,
};
