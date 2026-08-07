import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of } from 'rxjs';
import { SettingsActions } from './settings.actions';
import { SettingsApiPort } from '../services/settings-api.port';

@Injectable()
export class SettingsEffects {
  private actions$ = inject(Actions);
  private settingsApi = inject(SettingsApiPort);

  loadRoadTypes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.loadRoadTypes),
      exhaustMap(() =>
        this.settingsApi.listRoadTypes().pipe(
          map((items) => SettingsActions.loadRoadTypesSuccess({ items })),
          catchError(() => of(SettingsActions.loadRoadTypesFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  createRoadType$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.createRoadType),
      exhaustMap(({ payload }) =>
        this.settingsApi.createRoadType(payload).pipe(
          map((item) => SettingsActions.createRoadTypeSuccess({ item })),
          catchError((error: { message?: string }) =>
            of(SettingsActions.createRoadTypeFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  importMapData$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SettingsActions.importMapData),
      exhaustMap(({ payload }) =>
        this.settingsApi.importMapData(payload).pipe(
          map((result) => SettingsActions.importMapDataSuccess({ result })),
          catchError((error: { message?: string }) =>
            of(SettingsActions.importMapDataFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );
}
