import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { catchError, debounceTime, exhaustMap, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { StaffActions } from './staff.actions';
import { staffFeature } from './staff.reducer';
import { StaffApiPort } from '../services/staff-api.port';
import { AuthError } from '../../auth/models/auth.models'; // forme d'erreur générique réutilisée (code/message)

@Injectable()
export class StaffEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private staffApi = inject(StaffApiPort);
  private router = inject(Router);

  loadStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.loadStaff),
      withLatestFrom(this.store.select(staffFeature.selectFilters)),
      exhaustMap(([, filters]) =>
        this.staffApi.list(filters).pipe(
          map((items) => StaffActions.loadStaffSuccess({ items })),
          catchError(() => of(StaffActions.loadStaffFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  // Recharge automatiquement la liste à chaque changement de filtre,
  // avec un léger debounce pour ne pas spammer l'API pendant la frappe.
  reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setFilters),
      debounceTime(300),
      map(() => StaffActions.loadStaff()),
    ),
  );

  createStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.createStaff),
      exhaustMap(({ payload }) =>
        this.staffApi.create(payload).pipe(
          map(({ user, temporaryPassword }) => StaffActions.createStaffSuccess({ user, temporaryPassword })),
          catchError((error: AuthError) =>
            of(StaffActions.createStaffFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  updateStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.updateStaff),
      exhaustMap(({ id, payload }) =>
        this.staffApi.update(id, payload).pipe(
          map((user) => StaffActions.updateStaffSuccess({ user })),
          catchError(() => of(StaffActions.updateStaffFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  navigateAfterSave$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StaffActions.createStaffSuccess, StaffActions.updateStaffSuccess),
        map(() => this.router.navigate(['/staff'])),
      ),
    { dispatch: false },
  );

  // mergeMap : chaque ligne du tableau peut être activée/désactivée
  // indépendamment sans attendre la précédente (contrairement au formulaire,
  // qui utilise exhaustMap car une seule soumission a du sens à la fois).
  setEnabled$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setEnabled),
      mergeMap(({ id, enabled }) =>
        this.staffApi.setEnabled(id, enabled).pipe(
          map((user) => StaffActions.setEnabledSuccess({ user })),
          catchError(() => of(StaffActions.setEnabledFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  resetPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.resetPassword),
      mergeMap(({ id }) =>
        this.staffApi.resetPassword(id).pipe(
          map(({ temporaryPassword }) => StaffActions.resetPasswordSuccess({ temporaryPassword })),
          catchError(() => of(StaffActions.resetPasswordFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
