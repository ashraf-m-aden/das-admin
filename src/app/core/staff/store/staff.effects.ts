import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of } from 'rxjs';
import { StaffActions } from './staff.actions';
import { StaffApiPort } from '../services/staff-api.port';

@Injectable()
export class StaffEffects {
  private actions$ = inject(Actions);
  private staffApi = inject(StaffApiPort);

  loadStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.loadStaff),
      exhaustMap(() =>
        this.staffApi.list({ search: '', role: null }).pipe(
          map((items) => StaffActions.loadStaffSuccess({ items })),
          catchError(() => of(StaffActions.loadStaffFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  createStaff$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.createStaff),
      exhaustMap(({ payload }) =>
        this.staffApi.create(payload).pipe(
          map((user) => StaffActions.createStaffSuccess({ user })),
          catchError((error: { message?: string }) =>
            of(StaffActions.createStaffFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  setRoles$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setRoles),
      mergeMap(({ id, payload }) =>
        this.staffApi.setRoles(id, payload).pipe(
          map(() => StaffActions.setRolesSuccess({ id, roles: payload.roles })),
          catchError(() => of(StaffActions.setRolesFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  setActive$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StaffActions.setActive),
      mergeMap(({ id, isActive }) =>
        this.staffApi.setActive(id, isActive).pipe(
          map(() => StaffActions.setActiveSuccess({ id, isActive })),
          catchError(() => of(StaffActions.setActiveFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
