import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuthApiPort } from './auth-api.port';
import { AuthResponse, AuthenticatedUser, LoginCredentials } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class MockAuthApiService extends AuthApiPort {
  private static readonly SIMULATED_LATENCY_MS = 650;
  private static readonly MOCK_PASSWORD = 'das2026';

  private static readonly MOCK_ACCOUNTS: AuthenticatedUser[] = [
    { id: 'mock-admin-0001', login: 'admin', email: 'admin@das.dj', firstName: 'Ashraf', lastName: 'Admin', role: 'admin', profilePhotoUrl: null },
    { id: 'mock-supervisor-0001', login: 'superviseur', email: 'superviseur@das.dj', firstName: 'Fatouma', lastName: 'Superviseur', role: 'supervisor', profilePhotoUrl: null },
    { id: 'mock-surveyor-0001', login: 'agent', email: 'agent@das.dj', firstName: 'Idriss', lastName: 'Agent', role: 'surveyor', profilePhotoUrl: null },
  ];

  override login(credentials: LoginCredentials): Observable<AuthResponse> {
    const account = MockAuthApiService.MOCK_ACCOUNTS.find(
      (a) => a.login.toLowerCase() === credentials.login.trim().toLowerCase(),
    );

    if (!account || credentials.password !== MockAuthApiService.MOCK_PASSWORD) {
      return throwError(() => ({ code: 'invalid_credentials' as const, message: 'auth.invalidCredentials' })).pipe(
        delay(MockAuthApiService.SIMULATED_LATENCY_MS),
      );
    }

    const response: AuthResponse = {
      user: account,
      tokens: {
        accessToken: `mock.${account.id}.${Date.now()}`,
        refreshToken: `mock-refresh.${account.id}`,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      },
    };

    return of(response).pipe(delay(MockAuthApiService.SIMULATED_LATENCY_MS));
  }

  override logout(): Observable<void> {
    return of(undefined).pipe(delay(200));
  }

  override refresh(refreshToken: string): Observable<AuthResponse> {
    const account = MockAuthApiService.MOCK_ACCOUNTS.find((a) => `mock-refresh.${a.id}` === refreshToken);

    if (!account) {
      return throwError(() => ({ code: 'invalid_credentials' as const, message: 'Session expirée' }));
    }

    return of({
      user: account,
      tokens: {
        accessToken: `mock.${account.id}.${Date.now()}`,
        refreshToken,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      },
    }).pipe(delay(200));
  }
}
