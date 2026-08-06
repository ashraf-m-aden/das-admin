import { UUID, ISODateTime, UserRole } from '../../models/das.models';

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: ISODateTime;
}

export interface AuthenticatedUser {
  id: UUID;
  login: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profilePhotoUrl: string | null;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

export interface AuthError {
  code: 'invalid_credentials' | 'account_disabled' | 'network_error' | 'unknown';
  message: string;
}
