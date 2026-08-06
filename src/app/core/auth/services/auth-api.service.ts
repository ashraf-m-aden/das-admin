import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthApiPort } from './auth-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { AuthError, AuthResponse, LoginCredentials } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService extends AuthApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  override login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.config.get('apiBaseUrl')}/auth/login`, credentials)
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  override logout(): Observable<void> {
    return this.http
      .post<void>(`${this.config.get('apiBaseUrl')}/auth/logout`, {})
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  override refresh(refreshToken: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.config.get('apiBaseUrl')}/auth/refresh`, { refreshToken })
      .pipe(catchError((err) => throwError(() => this.toAuthError(err))));
  }

  private toAuthError(err: HttpErrorResponse): AuthError {
    if (err.status === 401) return { code: 'invalid_credentials', message: 'auth.invalidCredentials' };
    if (err.status === 403) return { code: 'account_disabled', message: 'Compte désactivé' };
    if (err.status === 0) return { code: 'network_error', message: 'common.error' };
    return { code: 'unknown', message: 'common.error' };
  }
}
