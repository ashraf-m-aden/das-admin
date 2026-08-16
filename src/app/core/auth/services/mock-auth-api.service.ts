import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuthApiPort } from './auth-api.port';
import { AuthResponse, AuthenticatedUser, LoginCredentials } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class MockAuthApiService extends AuthApiPort {
  private static readonly SIMULATED_LATENCY_MS = 650;
  private static readonly MOCK_PASSWORD = 'das2026';

  private static readonly MOCK_ACCOUNTS: Array<AuthenticatedUser & { username: string }> = [
    { id: 'mock-admin-0001', username: 'admin', fullName: 'Ashraf Admin', roles: ['Admin'] },
    { id: 'mock-supervisor-0001', username: 'superviseur', fullName: 'Fatouma Superviseur', roles: ['Superviseur'] },
    { id: 'mock-surveyor-0001', username: 'agent', fullName: 'Idriss Agent', roles: ['AgentTerrain'] },
  ];

override login(credentials: LoginCredentials): Observable<AuthResponse> {
    const account = MockAuthApiService.MOCK_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === credentials.username.trim().toLowerCase(),
    );

    if (!account || credentials.password !== MockAuthApiService.MOCK_PASSWORD) {
      return throwError(() => ({ code: 'invalid_credentials' as const, message: 'auth.invalidCredentials' })).pipe(
        delay(MockAuthApiService.SIMULATED_LATENCY_MS),
      );
    }

    const response: AuthResponse = {
      token: `mock.${account.id}.${Date.now()}`,
      refreshToken: `mock-refresh.${account.id}`,
      refreshTokenExpiresAtUtc: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      userId: account.id,
      fullName: account.fullName,
      roles: account.roles,
    };

    return of(response).pipe(delay(MockAuthApiService.SIMULATED_LATENCY_MS));
  }

  override refresh(refreshToken: string): Observable<AuthResponse> {
    const account = MockAuthApiService.MOCK_ACCOUNTS.find((a) => `mock-refresh.${a.id}` === refreshToken);
    if (!account) {
      return throwError(() => ({ code: 'invalid_credentials' as const, message: 'Session expirée' }));
    }
    const response: AuthResponse = {
      token: `mock.${account.id}.${Date.now()}`,
      refreshToken,
      refreshTokenExpiresAtUtc: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      userId: account.id,
      fullName: account.fullName,
      roles: account.roles,
    };
    return of(response).pipe(delay(200));
  }

  override logout(): Observable<void> {
    return of(undefined).pipe(delay(200));
  }


}
