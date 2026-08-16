import { AuthenticatedUser } from '../models/auth.models';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'error';

export interface AuthState {
  user: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  status: AuthStatus;
  errorMessageKey: string | null;
  roles:string[]
}

export const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  status: 'idle',
  errorMessageKey: null,
  roles:[]
};
