import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, debounceTime, exhaustMap, map, mergeMap, of, withLatestFrom } from 'rxjs';
import { AddressingActions } from './addressing.actions';
import { addressingFeature } from './addressing.reducer';
import { AddressingApiPort } from '../services/addressing-api.port';

@Injectable()
export class AddressingEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private addressingApi = inject(AddressingApiPort);

  loadBlocksToName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.loadBlocksToName),
      withLatestFrom(this.store.select(addressingFeature.selectBlockFilters)),
      exhaustMap(([, filters]) =>
        this.addressingApi.listBlocksToName(filters).pipe(
          map((items) => AddressingActions.loadBlocksToNameSuccess({ items })),
          catchError(() => of(AddressingActions.loadBlocksToNameFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadBlocksOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.setBlockFilters),
      debounceTime(300),
      map(() => AddressingActions.loadBlocksToName()),
    ),
  );

  assignBlockName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.assignBlockName),
      mergeMap(({ id, payload }) =>
        this.addressingApi.assignBlockName(id, payload).pipe(
          map((item) => AddressingActions.assignBlockNameSuccess({ item })),
          catchError(() => of(AddressingActions.assignBlockNameFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadStreetsToName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.loadStreetsToName),
      withLatestFrom(this.store.select(addressingFeature.selectStreetFilters)),
      exhaustMap(([, filters]) =>
        this.addressingApi.listStreetsToName(filters).pipe(
          map((items) => AddressingActions.loadStreetsToNameSuccess({ items })),
          catchError(() => of(AddressingActions.loadStreetsToNameFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadStreetsOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.setStreetFilters),
      debounceTime(300),
      map(() => AddressingActions.loadStreetsToName()),
    ),
  );

  assignStreetName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.assignStreetName),
      mergeMap(({ id, payload }) =>
        this.addressingApi.assignStreetName(id, payload).pipe(
          map((item) => AddressingActions.assignStreetNameSuccess({ item })),
          catchError(() => of(AddressingActions.assignStreetNameFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  loadPropertiesToNumber$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.loadPropertiesToNumber),
      exhaustMap(({ query }) =>
        this.addressingApi.listPropertiesToNumber(query).pipe(
          map((items) => AddressingActions.loadPropertiesToNumberSuccess({ items })),
          catchError(() => of(AddressingActions.loadPropertiesToNumberFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  assignHouseNumber$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.assignHouseNumber),
      mergeMap(({ id, payload }) =>
        this.addressingApi.assignHouseNumber(id, payload).pipe(
          map((item) => AddressingActions.assignHouseNumberSuccess({ item })),
          catchError(() => of(AddressingActions.assignHouseNumberFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );
}
