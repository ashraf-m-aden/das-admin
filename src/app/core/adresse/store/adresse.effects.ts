import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AdresseActions } from './adresse.actions';
import { adresseFeature } from './adresse.reducer';
import { AdresseApiPort } from '../services/adresse-api.port';
import { UnitsApiPort } from '../../units/services/units-api.port';

@Injectable()
export class AdresseEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(AdresseApiPort);
  private unitsApi = inject(UnitsApiPort);

  loadSummary$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.loadSummary),
    switchMap(() => this.api.summary().pipe(
      map((summary) => AdresseActions.loadSummarySuccess({ summary })),
      catchError(() => of(AdresseActions.loadSummaryFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  loadFilterOptions$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.loadSummary),
    switchMap(() => this.api.filterOptions().pipe(
      map((options) => AdresseActions.loadFilterOptionsSuccess({ options })),
      catchError(() => of(AdresseActions.loadFilterOptionsSuccess({ options: { postcodes: [], regions: [], teams: [], zones: [] } }))),
    )),
  ));

  triggerReload$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.setFilters, AdresseActions.setPage, AdresseActions.setPageSize, AdresseActions.mutationSuccess),
    map(() => AdresseActions.loadPage()),
  ));

  loadPage$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.loadPage),
    concatLatestFrom(() => [
      this.store.select(adresseFeature.selectFilters),
      this.store.select(adresseFeature.selectPage),
      this.store.select(adresseFeature.selectPageSize),
    ]),
    switchMap(([, filters, page, pageSize]) => this.api.list({ filters, page, pageSize }).pipe(
      map((res) => AdresseActions.loadPageSuccess(res)),
      catchError(() => of(AdresseActions.loadPageFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  openDetail$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.openDetail),
    switchMap(({ id }) =>
      forkJoin({
        detail: this.api.getDetail(id),
        units: this.unitsApi.listByAdresse(id),
      }).pipe(
        map(({ detail, units }) => AdresseActions.loadDetailSuccess({ detail: { ...detail, units } })),
        catchError(() => of(AdresseActions.loadDetailFailure({ errorMessageKey: 'common.error' }))),
      ),
    ),
  ));

  approveSelected$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.approveSelected),
    concatLatestFrom(() => this.store.select(adresseFeature.selectSelectedIds)),
    switchMap(([, ids]) => this.api.bulkUpdate({ ids, stage: 'Approved' }).pipe(
      map(() => AdresseActions.mutationSuccess()),
      catchError(() => of(AdresseActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  bulkUpdate$ = createEffect(() => this.actions$.pipe(
    ofType(AdresseActions.bulkUpdate),
    switchMap(({ payload }) => this.api.bulkUpdate(payload).pipe(
      map(() => AdresseActions.mutationSuccess()),
      catchError(() => of(AdresseActions.mutationFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));
}
