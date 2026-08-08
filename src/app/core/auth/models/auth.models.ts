import { UUID, ISODateTime, UserRole } from '../../models/das.models';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: ISODateTime;
}

export interface AuthenticatedUser {
  id: UUID;
  fullName: string;
  roles: UserRole[];
}

export interface AuthResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

export interface AuthError {
  code: 'invalid_credentials' | 'account_disabled' | 'network_error' | 'unknown';
  message: string;
}
