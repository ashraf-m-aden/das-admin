import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, map, of, switchMap } from 'rxjs';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import { ClosesApiPort } from '../services/closes-api.port';
import { BlocksApiPort } from '../../blocks/services/blocks-api.port';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';

/** Lit `err.error.code` (HttpErrorResponse réel) ou `err.code` (throwError direct du mock). */
function errorCode(err: unknown): string | undefined {
  const e = err as { error?: { code?: string }; code?: string } | null | undefined;
  return e?.error?.code ?? e?.code;
}

const ERROR_KEY_BY_CODE: Record<string, string> = {
  'Closes.NumberAlreadyUsed': 'closes.errorNumberUsed',
  'Closes.BlocAlreadyAssigned': 'closes.errorBlocTaken',
};

const toErrorKey = (err: unknown): string => ERROR_KEY_BY_CODE[errorCode(err) ?? ''] ?? 'common.error';

@Injectable()
export class ClosesEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ClosesApiPort);
  private blocksApi = inject(BlocksApiPort);

  /** Un seul geste utilisateur (choisir un quartier) → deux chargements. */
  onQuartierSelected$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.selectQuartier),
    map(() => ClosesActions.loadList()),
  ));

  /** Les filtres viennent du store (`concatLatestFrom`) plutôt que du payload — cf. CLAUDE.md §4. */
  loadList$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.loadList),
    concatLatestFrom(() => this.store.select(closesFeature.selectQuartierId)),
    switchMap(([, quartierId]) => this.api.list({ quartierId, search: '' }).pipe(
      map((closes) => ClosesActions.loadListSuccess({ closes })),
      catchError(() => of(ClosesActions.loadListFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  loadBlocs$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.selectQuartier),
    switchMap(({ quartierId }) => {
      if (!quartierId) return of(ClosesActions.loadBlocsSuccess({ blocs: [] }));
      return this.blocksApi.list({ ...EMPTY_HIERARCHY_SELECTION, quartierId }).pipe(
        map((blocs) => ClosesActions.loadBlocsSuccess({ blocs })),
        catchError(() => of(ClosesActions.loadBlocsSuccess({ blocs: [] }))),
      );
    }),
  ));

  saveClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveClose),
    switchMap(({ id, payload }) => (id ? this.api.update(id, payload) : this.api.create(payload)).pipe(
      map(() => ClosesActions.saveCloseSuccess()),
      catchError((err: unknown) => of(ClosesActions.saveCloseFailure({ errorMessageKey: toErrorKey(err) }))),
    )),
  ));

  removeClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.removeClose),
    switchMap(({ id }) => this.api.remove(id).pipe(
      map(() => ClosesActions.removeCloseSuccess()),
      catchError((err: unknown) => of(ClosesActions.removeCloseFailure({ errorMessageKey: toErrorKey(err) }))),
    )),
  ));

  /** Toute écriture réussie relit la liste — les numéros et les rattachements de blocs ont pu bouger. */
  reloadAfterWrite$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveCloseSuccess, ClosesActions.removeCloseSuccess),
    map(() => ClosesActions.loadList()),
  ));
}
