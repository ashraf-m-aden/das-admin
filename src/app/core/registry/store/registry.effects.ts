import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import { RegistryActions } from './registry.actions';
import { registryFeature } from './registry.reducer';
import { RegistryApiPort } from '../services/registry-api.port';

@Injectable()
export class RegistryEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(RegistryApiPort);

  loadSummary$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.loadSummary),
    switchMap(() => this.api.summary().pipe(
      map((summary) => RegistryActions.loadSummarySuccess({ summary })),
      catchError(() => of(RegistryActions.loadSummaryFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  loadFilterOptions$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.loadSummary),
    switchMap(() => this.api.filterOptions().pipe(
      map((options) => RegistryActions.loadFilterOptionsSuccess({ options })),
      catchError(() => of(RegistryActions.loadFilterOptionsSuccess({ options: { postcodes: [], regions: [], teams: [], zones: [] } }))),
    )),
  ));

  triggerReload$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.setFilters, RegistryActions.setPage, RegistryActions.setPageSize, RegistryActions.mutationSuccess),
    map(() => RegistryActions.loadPage()),
  ));

  loadPage$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.loadPage),
    concatLatestFrom(() => [
      this.store.select(registryFeature.selectFilters),
      this.store.select(registryFeature.selectPage),
      this.store.select(registryFeature.selectPageSize),
    ]),
    switchMap(([, filters, page, pageSize]) => this.api.list({ filters, page, pageSize }).pipe(
      map((res) => RegistryActions.loadPageSuccess(res)),
      catchError(() => of(RegistryActions.loadPageFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  openDetail$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.openDetail),
    switchMap(({ id }) => this.api.getDetail(id).pipe(
      map((detail) => RegistryActions.loadDetailSuccess({ detail })),
      catchError(() => of(RegistryActions.loadDetailFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  approveSelected$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.approveSelected),
    concatLatestFrom(() => this.store.select(registryFeature.selectSelectedIds)),
    switchMap(([, ids]) => this.api.approve(ids).pipe(
      map(() => RegistryActions.mutationSuccess()),
      catchError(() => of(RegistryActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  changeTeam$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.changeTeam),
    concatLatestFrom(() => this.store.select(registryFeature.selectSelectedIds)),
    switchMap(([{ team }, ids]) => this.api.bulkUpdate({ ids, team }).pipe(
      map(() => RegistryActions.mutationSuccess()),
      catchError(() => of(RegistryActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  bulkUpdate$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.bulkUpdate),
    switchMap(({ payload }) => this.api.bulkUpdate(payload).pipe(
      map(() => RegistryActions.mutationSuccess()),
      catchError(() => of(RegistryActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  flagForReview$ = createEffect(() => this.actions$.pipe(
    ofType(RegistryActions.flagForReview),
    switchMap(({ id }) => this.api.flagForReview(id).pipe(
      map(() => RegistryActions.mutationSuccess()),
      catchError(() => of(RegistryActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));
}
