import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, defer, filter, map, of, switchMap } from 'rxjs';
import { ClosesActions } from './closes.actions';
import { closesFeature } from './closes.reducer';
import { selectEffectivePlan } from './closes.selectors';
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
  'Closes.NumberingDuplicate': 'closes.errorNumberingDuplicate',
  'Closes.NumberingIncomplete': 'closes.errorNumberingIncomplete',
  'Closes.NumberingForeignAdresse': 'closes.errorNumberingForeign',
  'Closes.NumberingOutOfRange': 'closes.errorNumberingOutOfRange',
  'Blocs.NotFound': 'closes.errorNotFound',
  'Streets.NotFound': 'closes.errorStreetNotFound',
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

  /**
   * `quartierId` est retiré du corps en modification : le back ne le modifie pas (`Close.Update`).
   *
   * Nommage de rue « d'une pierre deux coups » : si l'action porte un `streetName`, la rue est
   * renommée AVANT l'écriture de la close. L'ordre n'est pas cosmétique — le back dérive
   * `Close.Label` de `Street.Name`, donc une close écrite avant le renommage repartirait avec
   * l'ancien libellé jusqu'au prochain rechargement.
   *
   * La rue complète est relue dans le store et non portée par l'action : `PATCH /api/streets/{id}`
   * est un REMPLACEMENT, il faut lui rendre `code` et `type` inchangés — les recomposer depuis
   * l'écran les exposerait à être écrasés par une valeur par défaut.
   *
   * Un échec du renommage annule la close. C'est délibéré : enchaîner quand même laisserait une
   * close créée sous un libellé que l'opérateur croit avoir corrigé.
   */
  saveClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveClose),
    concatLatestFrom(() => this.store.select(closesFeature.selectStreets)),
    switchMap(([{ id, payload, streetName }, streets]) => {
      const write$ = defer(() => id
        ? this.api.update(id, {
          streetId: payload.streetId, number: payload.number,
          code: payload.code, boundaryWkt: payload.boundaryWkt,
        })
        : this.api.create(payload));

      const street = streets.find((s) => s.id === payload.streetId);
      const name = streetName?.trim();
      const request$ = name && street && street.name !== name
        ? this.api.renameStreet(street, name).pipe(switchMap(() => write$))
        : write$;

      return request$.pipe(
        map(() => ClosesActions.saveCloseSuccess()),
        catchError((err: unknown) => of(ClosesActions.saveCloseFailure({ errorMessageKey: toKey(err) }))),
      );
    }),
  ));

  /**
   * Le nom de rue affiché dans le sélecteur vient de `streets`, que `reloadAfterWrite$` ne
   * recharge pas (il ne relit que closes et blocs). Sans ceci, une rue tout juste nommée
   * réapparaîtrait sans nom dans le formulaire suivant.
   */
  reloadStreetsAfterSave$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.saveCloseSuccess),
    map(() => ClosesActions.loadStreets()),
  ));

  removeClose$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.removeClose),
    switchMap(({ id }) => this.api.remove(id).pipe(
      map(() => ClosesActions.removeCloseSuccess()),
      catchError((err: unknown) => of(ClosesActions.removeCloseFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  previewNumbering$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.previewNumbering),
    switchMap(({ closeId, blocIds, reverse }) => this.api.previewAttachBlocs(closeId, blocIds, reverse).pipe(
      map((plan) => ClosesActions.previewNumberingSuccess({ plan, blocIds })),
      catchError((err: unknown) => of(ClosesActions.previewNumberingFailure({ errorMessageKey: toErrorKey(err, ERROR_KEY_BY_CODE) }))),
    )),
  ));

  attachBlocs$ = createEffect(() => this.actions$.pipe(
    ofType(ClosesActions.attachBlocs),
    // Le plan validé est lu DANS LE STORE plutôt que porté par l'action : c'est de l'état relu
    // à l'écran, pas une donnée du geste (CLAUDE.md §4). L'envoyer dans le payload obligerait
    // l'écran à recomposer ce que le sélecteur sait déjà faire.
    concatLatestFrom(() => this.store.select(selectEffectivePlan)),
    switchMap(([{ closeId, blocIds }, plan]) => {
      const numbering = plan?.adresses.map((a) => ({ adresseId: a.adresseId, numero: a.effectiveNumero }));
      return this.api.attachBlocs(closeId, blocIds, numbering).pipe(
        map(() => ClosesActions.attachBlocsSuccess()),
        catchError((err: unknown) => of(ClosesActions.attachBlocsFailure({ errorMessageKey: toErrorKey(err, ERROR_KEY_BY_CODE) }))),
      );
    }),
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
