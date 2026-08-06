import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { AuthActions } from './auth.actions';
import { AuthApiPort } from '../services/auth-api.port';
import { AuthStorageService } from '../services/auth-storage.service';
import { AuthError, AuthResponse } from '../models/auth.models';

@Injectable()
export class AuthEffects {
  private actions$ = inject(Actions);
  private authApi = inject(AuthApiPort);
  private storage = inject(AuthStorageService);
  private router = inject(Router);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      exhaustMap(({ credentials }) =>
        this.authApi.login(credentials).pipe(
          map((response: AuthResponse) => AuthActions.loginSuccess({ response })),
          catchError((error: AuthError) =>
            of(AuthActions.loginFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  persistOnLoginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess, AuthActions.restoreSessionSuccess),
        tap(({ response }) => this.storage.save(response)),
      ),
    { dispatch: false },
  );

  redirectOnLoginSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess),
        tap(() => this.router.navigateByUrl(this.resolveReturnUrl())),
      ),
    { dispatch: false },
  );

  restoreSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.restoreSession),
      exhaustMap(() => {
        const stored = this.storage.load();
        if (!stored) return of(AuthActions.restoreSessionFailure());

        const response: AuthResponse = {
          user: stored.user,
          tokens: { accessToken: stored.accessToken, refreshToken: stored.refreshToken, expiresAt: stored.expiresAt },
        };
        return of(AuthActions.restoreSessionSuccess({ response }));
      }),
    ),
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      exhaustMap(() =>
        this.authApi.logout().pipe(
          map(() => AuthActions.logoutComplete()),
          catchError(() => of(AuthActions.logoutComplete())),
        ),
      ),
    ),
  );

  cleanupOnLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutComplete),
        tap(() => {
          this.storage.clear();
          this.router.navigate(['/login']);
        }),
      ),
    { dispatch: false },
  );

  private resolveReturnUrl(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get('returnUrl') ?? '/dashboard';
  }
}
