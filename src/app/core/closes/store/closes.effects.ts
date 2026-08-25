import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import { ClosesApiPort } from '../services/closes-api.port';
import { BlocksApiPort } from '../../blocks/services/blocks-api.port';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/**
 * Codes métier de `/api/closes`, relevés dans la source `dasApi` le 2026-08-24
 * (`grep '"Closes\.' src`). Ils se testent, jamais le `message` (CLAUDE.md §6).
 *
 * ⚠️ Ces chaînes ne se devinent pas — six des neuf valeurs posées ici avant relecture de la
 * source étaient fausses (`CodeAlreadyUsed` pour `CodeAlreadyExists`, `FrozenAddressCode` pour
 * `AddressCodeFrozen`…), et une erreur de frappe ne se voit pas : elle retombe silencieusement
 * sur `common.error`. Toute nouvelle entrée se vérifie contre la source, pas contre la doc.
 *
 * `Closes.DuplicateAdresseNumero` est le refus le plus fréquent aujourd'hui : chaque bloc
 * numérote ses parcelles à partir de 1, donc réunir deux blocs sous une close fait collider
 * leurs numéros de maison tant que la renumérotation n'a pas eu lieu (`AttachBlocsHandler`,
 * garde 3).
 *
 * Pas d'entrée pour « ce bloc est déjà dans une autre close » : le back ne le refuse PAS, il
 * traite le cas comme un déplacement, et ne le bloque que si une parcelle porte un code
 * d'adresse figé (`Closes.AddressCodeFrozen`).
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'Closes.NumberAlreadyUsed': 'closes.errorNumberUsed',
  'Closes.CodeAlreadyExists': 'closes.errorCodeUsed',
  'Closes.StreetAlreadyUsed': 'closes.errorStreetUsed',
  'Closes.BlocOutsideQuartier': 'closes.errorBlocOtherQuartier',
  'Closes.DuplicateAdresseNumero': 'closes.errorNumeroCollision',
  'Closes.AddressCodeFrozen': 'closes.errorFrozenCode',
  'Closes.HasBlocs': 'closes.errorHasBlocs',
  'Closes.HasAdresses': 'closes.errorHasAdresses',
  'Closes.BlocNotAttached': 'closes.errorBlocNotAttached',
  // Écran désynchronisé (close supprimée ailleurs, bloc disparu) : `Blocs.NotFound` sort aussi
  // du rattachement. Même conseil dans les deux cas — recharger.
  'Closes.NotFound': 'closes.errorNotFound',
  'Blocs.NotFound': 'closes.errorNotFound',
};

const toKey = (err: unknown): string => toErrorKey(err, ERROR_KEY_BY_CODE);

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
        catchError((err: unknown) => of(ClosesActions.saveCloseFailure({ errorMessageKey: toKey(err) }))),
      );
    }),
  ));

  removeClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.removeClose),
    switchMap(({ id }) => this.api.remove(id).pipe(
      map(() => ClosesActions.removeCloseSuccess()),
      catchError((err: unknown) => of(ClosesActions.removeCloseFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  attachBlocs$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.attachBlocs),
    switchMap(({ closeId, blocIds }) => this.api.attachBlocs(closeId, blocIds).pipe(
      map(() => ClosesActions.attachBlocsSuccess()),
      catchError((err: unknown) => of(ClosesActions.attachBlocsFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  detachBloc$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.detachBloc),
    switchMap(({ closeId, blocId }) => this.api.detachBloc(closeId, blocId).pipe(
      map(() => ClosesActions.detachBlocSuccess()),
      catchError((err: unknown) => of(ClosesActions.detachBlocFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  /**
   * Le numéro d'une close n'est plus saisi : le front prend le premier libre. Deux opérateurs
   * simultanés peuvent donc calculer le même, et le second reçoit un 409. Recharger la liste
   * suffit à réparer — la tentative suivante repartira d'un numéro réellement libre.
   *
   * Pas de nouvel essai automatique : il masquerait une écriture concurrente sur une donnée qui
   * entre dans le code d'adresse. L'opérateur revalide, en sachant ce qu'il fait.
   */
  reloadAfterNumberConflict$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveCloseFailure),
    filter(({ errorMessageKey }) => errorMessageKey === 'closes.errorNumberUsed'),
    map(() => ClosesActions.loadList()),
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
