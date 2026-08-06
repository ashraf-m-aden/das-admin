import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthActions } from './auth.actions';
import { authFeature } from './auth.reducer';
import { selectIsAuthenticated, selectIsAuthLoading, selectUserFullName, selectUserRole } from './auth.selectors';
import { LoginCredentials } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private store = inject(Store);

  user$ = this.store.select(authFeature.selectUser);
  role$ = this.store.select(selectUserRole);
  fullName$ = this.store.select(selectUserFullName);
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  isLoading$ = this.store.select(selectIsAuthLoading);
  errorMessageKey$ = this.store.select(authFeature.selectErrorMessageKey);

  login(credentials: LoginCredentials): void {
    this.store.dispatch(AuthActions.login({ credentials }));
  }

  logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  restoreSession(): void {
    this.store.dispatch(AuthActions.restoreSession());
  }
}
