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

/**
 * Codes métier du back (`ErrorResponse.Code`). Ils se testent, jamais le `message` (CLAUDE.md §6).
 * `Closes.BlocNumeroCollision` est le cas courant tant que la renumérotation n'a pas eu lieu :
 * chaque bloc numérotant à partir de 1, réunir deux blocs sous une close fait collider leurs
 * numéros de maison — le back le refuse, et c'est la règle plus que l'exception aujourd'hui.
 */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  'Closes.NumberAlreadyUsed': 'closes.errorNumberUsed',
  'Closes.CodeAlreadyUsed': 'closes.errorCodeUsed',
  'Closes.StreetAlreadyUsed': 'closes.errorStreetUsed',
  'Closes.BlocAlreadyAssigned': 'closes.errorBlocTaken',
  'Closes.BlocOtherQuartier': 'closes.errorBlocOtherQuartier',
  'Closes.NumeroCollision': 'closes.errorNumeroCollision',
  'Closes.BlocNumeroCollision': 'closes.errorNumeroCollision',
  'Closes.FrozenAddressCode': 'closes.errorFrozenCode',
  'Closes.HasBlocs': 'closes.errorHasBlocs',
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
    switchMap(([, quartierId]) => this.api.list({ quartierId }).pipe(
      map((closes) => ClosesActions.loadListSuccess({ closes })),
      catchError(() => of(ClosesActions.loadListFailure({ errorMessageKey: 'common.error' }))),
    )),
  ));

  loadStreets$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.loadStreets),
    switchMap(() => this.api.listStreets().pipe(
      map((streets) => ClosesActions.loadStreetsSuccess({ streets })),
      catchError(() => of(ClosesActions.loadStreetsSuccess({ streets: [] }))),
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

  /** `quartierId` est retiré du corps en modification : le back ne le modifie pas (`Close.Update`). */
  saveClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveClose),
    switchMap(({ id, payload }) => {
      const request$ = id
        ? this.api.update(id, {
          streetId: payload.streetId, number: payload.number,
          code: payload.code, boundaryWkt: payload.boundaryWkt,
        })
        : this.api.create(payload);
      return request$.pipe(
        map(() => ClosesActions.saveCloseSuccess()),
        catchError((err: unknown) => of(ClosesActions.saveCloseFailure({ errorMessageKey: toErrorKey(err) }))),
      );
    }),
  ));

  removeClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.removeClose),
    switchMap(({ id }) => this.api.remove(id).pipe(
      map(() => ClosesActions.removeCloseSuccess()),
      catchError((err: unknown) => of(ClosesActions.removeCloseFailure({ errorMessageKey: toErrorKey(err) }))),
    )),
  ));

  attachBlocs$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.attachBlocs),
    switchMap(({ closeId, blocIds }) => this.api.attachBlocs(closeId, blocIds).pipe(
      map(() => ClosesActions.attachBlocsSuccess()),
      catchError((err: unknown) => of(ClosesActions.attachBlocsFailure({ errorMessageKey: toErrorKey(err) }))),
    )),
  ));

  detachBloc$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.detachBloc),
    switchMap(({ closeId, blocId }) => this.api.detachBloc(closeId, blocId).pipe(
      map(() => ClosesActions.detachBlocSuccess()),
      catchError((err: unknown) => of(ClosesActions.detachBlocFailure({ errorMessageKey: toErrorKey(err) }))),
    )),
  ));

  /**
   * Toute écriture réussie relit la liste ET les blocs : `Bloc.closeId` change au
   * rattachement/détachement, et c'est lui qui pilote le grisage du sélecteur.
   */
  reloadAfterWrite$ = createEffect(() => this.actions$.pipe(
    ofType(
      ClosesActions.saveCloseSuccess, ClosesActions.removeCloseSuccess,
      ClosesActions.attachBlocsSuccess, ClosesActions.detachBlocSuccess,
    ),
    concatLatestFrom(() => this.store.select(closesFeature.selectQuartierId)),
    map(([, quartierId]) => ClosesActions.selectQuartier({ quartierId })),
  ));
}
