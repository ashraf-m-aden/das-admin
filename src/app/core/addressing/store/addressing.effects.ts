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
    this.actions$.pipe(ofType(AddressingActions.setBlockFilters), debounceTime(300), map(() => AddressingActions.loadBlocksToName())),
  );

  setBlockName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.setBlockName),
      mergeMap(({ id, name }) =>
        this.addressingApi.setBlockName(id, name).pipe(
          map((item) => AddressingActions.blockNameActionSuccess({ item })),
          catchError(() => of(AddressingActions.blockNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  approveBlockSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.approveBlockSuggestion),
      mergeMap(({ suggestionId }) =>
        this.addressingApi.approveBlockSuggestion(suggestionId).pipe(
          map(() => AddressingActions.blockSuggestionDecided()),
          catchError(() => of(AddressingActions.blockNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  rejectBlockSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.rejectBlockSuggestion),
      mergeMap(({ suggestionId, rejectionReason }) =>
        this.addressingApi.rejectBlockSuggestion(suggestionId, rejectionReason).pipe(
          map(() => AddressingActions.blockSuggestionDecided()),
          catchError(() => of(AddressingActions.blockNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadBlocksAfterSuggestionDecision$ = createEffect(() =>
    this.actions$.pipe(ofType(AddressingActions.blockSuggestionDecided), map(() => AddressingActions.loadBlocksToName())),
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
    this.actions$.pipe(ofType(AddressingActions.setStreetFilters), debounceTime(300), map(() => AddressingActions.loadStreetsToName())),
  );

  setStreetName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.setStreetName),
      mergeMap(({ id, name }) =>
        this.addressingApi.setStreetName(id, name).pipe(
          map((item) => AddressingActions.streetNameActionSuccess({ item })),
          catchError(() => of(AddressingActions.streetNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  approveStreetSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.approveStreetSuggestion),
      mergeMap(({ suggestionId }) =>
        this.addressingApi.approveStreetSuggestion(suggestionId).pipe(
          map(() => AddressingActions.streetSuggestionDecided()),
          catchError(() => of(AddressingActions.streetNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  rejectStreetSuggestion$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AddressingActions.rejectStreetSuggestion),
      mergeMap(({ suggestionId, rejectionReason }) =>
        this.addressingApi.rejectStreetSuggestion(suggestionId, rejectionReason).pipe(
          map(() => AddressingActions.streetSuggestionDecided()),
          catchError(() => of(AddressingActions.streetNameActionFailure({ errorMessageKey: 'common.error' }))),
        ),
      ),
    ),
  );

  reloadStreetsAfterSuggestionDecision$ = createEffect(() =>
    this.actions$.pipe(ofType(AddressingActions.streetSuggestionDecided), map(() => AddressingActions.loadStreetsToName())),
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
