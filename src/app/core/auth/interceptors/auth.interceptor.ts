import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { catchError, switchMap, take, throwError } from 'rxjs';
import { authFeature } from '../store/auth.reducer';
import { AuthActions } from '../store/auth.actions';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);

  return store.select(authFeature.selectAccessToken).pipe(
    take(1),
    switchMap((token) => {
      const authedReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

      return next(authedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            store.dispatch(AuthActions.logoutComplete());
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};
