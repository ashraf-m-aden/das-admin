import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, map, of, switchMap } from 'rxjs';
import { DiscoveriesActions } from './discoveries.actions';
import { DiscoveriesApiPort } from '../services/discoveries-api.port';
import { FieldOpsApiPort } from '../../fieldops/services/fieldops-api.port';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';
import { selectQuery } from './discoveries.selectors';

/**
 * Codes métier de `/api/discoveries`, relevés dans la source `dasApi` le 2026-08-25.
 * Testés sur `code`, jamais sur `message` (CLAUDE.md §6).
 *
 * `AlreadyReviewed` est le seul refus courant de cet écran, et il a une cause banale : deux
 * Gestionnaires trient la même file en parallèle. Le message doit dire de recharger, pas
 * « une erreur est survenue ».
 *
 * `NotOwner` et `NotOnCampaign` ne sont pas mappés : ils ne sortent que de `POST /` (création
 * par un agent terrain), route absente de ce port.
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'DiscoveryReports.AlreadyReviewed': 'discoveries.errorAlreadyReviewed',
  'DiscoveryReports.NotFound': 'discoveries.errorNotFound',
};

const toKey = (err: unknown): string => toErrorKey(err, ERROR_KEY_BY_CODE);

@Injectable()
export class DiscoveriesEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(DiscoveriesApiPort);
  private fieldOpsApi = inject(FieldOpsApiPort);

  /** Un geste (changer un filtre) → un rechargement. Les deux filtres passent par le même chemin. */
  onFilterChanged$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.setCampaignFilter, DiscoveriesActions.setStatusFilter),
    map(() => DiscoveriesActions.loadList()),
  ));

  loadList$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.loadList),
    concatLatestFrom(() => this.store.select(selectQuery)),
    switchMap(([, query]) => this.api.list(query).pipe(
      map((reports) => DiscoveriesActions.loadListSuccess({ reports })),
      catchError((err: unknown) => of(DiscoveriesActions.loadListFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  /**
   * Référentiel des campagnes pour le filtre. `exhaustMap` : c'est une liste immuable à
   * l'échelle de la visite, un second appel concurrent ne servirait à rien.
   *
   * Un échec est absorbé en liste vide plutôt qu'en erreur d'écran : le filtre par campagne est
   * un confort, son absence ne doit pas masquer la file de tri elle-même.
   */
  loadCampaigns$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.loadList),
    exhaustMap(() => this.fieldOpsApi.listCampaigns(null).pipe(
      map((campaigns) => DiscoveriesActions.loadCampaignsSuccess({
        campaigns: campaigns.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` })),
      })),
      catchError(() => of(DiscoveriesActions.loadCampaignsSuccess({ campaigns: [] }))),
    )),
  ));

  accept$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.accept),
    switchMap(({ id }) => this.api.accept(id).pipe(
      map((report) => DiscoveriesActions.reviewSuccess({ report })),
      catchError((err: unknown) => of(DiscoveriesActions.reviewFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  reject$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.reject),
    switchMap(({ id, rejectionReason }) => this.api.reject(id, rejectionReason).pipe(
      map((report) => DiscoveriesActions.reviewSuccess({ report })),
      catchError((err: unknown) => of(DiscoveriesActions.reviewFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  /**
   * Une décision réussie relit la liste au lieu de patcher la ligne en mémoire : avec le filtre
   * `Pending` par défaut, le signalement trié doit SORTIR de la file. Le patcher le laisserait
   * affiché avec son nouveau statut, dans une liste censée ne contenir que du non-trié.
   */
  reloadAfterReview$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.reviewSuccess),
    map(() => DiscoveriesActions.loadList()),
  ));

  export$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.export),
    concatLatestFrom(() => this.store.select(selectQuery)),
    exhaustMap(([, query]) => this.api.exportGeoJson(query).pipe(
      map((collection) => DiscoveriesActions.exportSuccess({ collection })),
      catchError((err: unknown) => of(DiscoveriesActions.exportFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  /**
   * Remise du fichier à l'opérateur. `dispatch: false` : c'est un effet de bord navigateur, il
   * ne produit pas d'état — et la FeatureCollection n'a rien à faire dans le store, personne ne
   * la relit.
   *
   * `URL.revokeObjectURL` est indispensable : sans lui le Blob reste retenu par le document
   * jusqu'au rechargement de la page, et l'export d'une grande campagne fuit à chaque clic.
   */
  downloadExport$ = createEffect(() => this.actions$.pipe(
    ofType(DiscoveriesActions.exportSuccess),
    map(({ collection }) => {
      const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signalements-${new Date().toISOString().slice(0, 10)}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    }),
  ), { dispatch: false });
}
