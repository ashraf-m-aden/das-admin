import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Router } from '@angular/router';
import { catchError, exhaustMap, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { ClientsActions } from './clients.actions';
import { clientsFeature } from './clients.reducer';
import { ClientsApiPort } from '../services/clients-api.port';

@Injectable()
export class ClientsEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private clientsApi = inject(ClientsApiPort);
  private router = inject(Router);

  loadList$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.loadList),
      withLatestFrom(this.store.select(clientsFeature.selectFilters)),
      exhaustMap(([, filters]) =>
        this.clientsApi.list(filters).pipe(
          map((items) => ClientsActions.loadListSuccess({ items })),
          catchError(() => of(ClientsActions.loadListFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(ofType(ClientsActions.setFilters), map(() => ClientsActions.loadList())),
  );

  loadPlans$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.loadPlans),
      exhaustMap(() => this.clientsApi.listPlans().pipe(map((items) => ClientsActions.loadPlansSuccess({ items })))),
    ),
  );

  createClient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.createClient),
      exhaustMap(({ payload }) =>
        this.clientsApi.create(payload).pipe(
          map(({ client, temporaryPassword }) => ClientsActions.createClientSuccess({ client, temporaryPassword })),
          catchError((error: { message?: string }) =>
            of(ClientsActions.createClientFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  updateClient$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.updateClient),
      exhaustMap(({ id, payload }) =>
        this.clientsApi.update(id, payload).pipe(
          map((client) => ClientsActions.updateClientSuccess({ client })),
          catchError(() => of(ClientsActions.updateClientFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  navigateAfterSave$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ClientsActions.createClientSuccess, ClientsActions.updateClientSuccess),
        map(() => this.router.navigate(['/clients'])),
      ),
    { dispatch: false },
  );

  setEnabled$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.setEnabled),
      mergeMap(({ id, enabled }) =>
        this.clientsApi.setEnabled(id, enabled).pipe(
          map((client) => ClientsActions.setEnabledSuccess({ client })),
          catchError(() => of(ClientsActions.setEnabledFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadZoneAccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.loadZoneAccess),
      exhaustMap(({ clientId }) =>
        this.clientsApi.listZoneAccess(clientId).pipe(
          map((items) => ClientsActions.loadZoneAccessSuccess({ items })),
          catchError(() => of(ClientsActions.loadZoneAccessFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadAvailableZones$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.loadAvailableZones),
      exhaustMap(() => this.clientsApi.listAvailableZones().pipe(map((items) => ClientsActions.loadAvailableZonesSuccess({ items })))),
    ),
  );

  grantZoneAccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.grantZoneAccess),
      mergeMap(({ clientId, payload }) =>
        this.clientsApi.grantZoneAccess(clientId, payload).pipe(
          map((item) => ClientsActions.grantZoneAccessSuccess({ item })),
          catchError((error: { message?: string }) =>
            of(ClientsActions.grantZoneAccessFailure({ errorMessageKey: error.message ?? 'common.error' })),
          ),
        ),
      ),
    ),
  );

  revokeZoneAccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.revokeZoneAccess),
      mergeMap(({ clientId, zoneAccessId }) =>
        this.clientsApi.revokeZoneAccess(clientId, zoneAccessId).pipe(
          map((item) => ClientsActions.revokeZoneAccessSuccess({ item })),
          catchError(() => of(ClientsActions.revokeZoneAccessFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadApiToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.loadApiToken),
      exhaustMap(({ clientId }) =>
        this.clientsApi.getApiToken(clientId).pipe(
          map((item) => ClientsActions.loadApiTokenSuccess({ item })),
          catchError(() => of(ClientsActions.loadApiTokenFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  regenerateApiToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.regenerateApiToken),
      exhaustMap(({ clientId, payload }) =>
        this.clientsApi.regenerateApiToken(clientId, payload).pipe(
          map(({ token, rawToken }) => ClientsActions.regenerateApiTokenSuccess({ token, rawToken })),
          catchError(() => of(ClientsActions.regenerateApiTokenFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  revokeApiToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ClientsActions.revokeApiToken),
      exhaustMap(({ clientId }) =>
        this.clientsApi.revokeApiToken(clientId).pipe(
          map(() => ClientsActions.revokeApiTokenSuccess()),
          catchError(() => of(ClientsActions.revokeApiTokenFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
