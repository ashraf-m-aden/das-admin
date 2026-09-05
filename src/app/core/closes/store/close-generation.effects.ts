import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { CloseGenerationActions } from './close-generation.actions';
import { closeGenerationFeature } from './close-generation.reducer';
import { selectProposals } from './close-generation.selectors';
import { ClosesApiPort } from '../services/closes-api.port';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/**
 * Codes métier des routes de génération, relevés dans `dasApi` le 2026-09-04. Ils se testent,
 * jamais le `message` (CLAUDE.md §6).
 *
 * `Quartiers.NotFound` sort des trois routes : l'écran est désynchronisé, il faut recharger.
 * `Blocs.NotFound` sort de la numérotation quand un bloc du plan a disparu entre-temps.
 */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'Quartiers.NotFound': 'closes.generation.errorQuartierNotFound',
  'Blocs.NotFound': 'closes.generation.errorBlocNotFound',
  'Closes.BlocOutsideQuartier': 'closes.errorBlocOtherQuartier',
  'Closes.AddressCodeFrozen': 'closes.errorFrozenCode',
  'Streets.NotFound': 'closes.errorStreetNotFound',
};

const toKey = (err: unknown): string => toErrorKey(err, ERROR_KEY_BY_CODE);

@Injectable()
export class CloseGenerationEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private api = inject(ClosesApiPort);

  loadProgress$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.loadProgress),
    switchMap(() => this.api.listQuartierProgress().pipe(
      map((progress) => CloseGenerationActions.loadProgressSuccess({ progress })),
      catchError((err) => of(CloseGenerationActions.loadProgressFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  loadStreets$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.loadStreets),
    switchMap(() => this.api.listStreets().pipe(
      map((streets) => CloseGenerationActions.loadStreetsSuccess({ streets })),
      // Le référentiel de rues n'est pas vital à l'aperçu : son échec ne doit pas masquer le
      // plan. Il ne prive que du changement de rue et du renommage en ligne.
      catchError(() => of(CloseGenerationActions.loadStreetsSuccess({ streets: [] }))),
    )),
  ));

  /** Choisir un quartier, ou changer les réglages, demande un nouvel aperçu. */
  onQuartierOrParameters$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.selectQuartier, CloseGenerationActions.setParameters),
    concatLatestFrom(() => this.store.select(closeGenerationFeature.selectQuartierId)),
    filter(([, quartierId]) => !!quartierId),
    map(() => CloseGenerationActions.preview()),
  ));

  /** Quartier et réglages sont relus dans le store, pas trimballés dans le payload (CLAUDE.md §4). */
  preview$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.preview),
    concatLatestFrom(() => [
      this.store.select(closeGenerationFeature.selectQuartierId),
      this.store.select(closeGenerationFeature.selectParameters),
    ]),
    filter(([, quartierId]) => !!quartierId),
    switchMap(([, quartierId, parameters]) => this.api.previewQuartierCloses(quartierId!, parameters).pipe(
      map((plan) => CloseGenerationActions.previewSuccess({ plan })),
      catchError((err) => of(CloseGenerationActions.previewFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));

  /**
   * La close envoyée est celle qui est À L'ÉCRAN — proposition plus corrections — et non celle
   * que la machine avait proposée. C'est la raison d'être de la route : elle décrit la close au
   * lieu de la référencer par une clé qui pointerait sur la proposition d'origine.
   */
  openNumbering$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.openNumbering),
    concatLatestFrom(() => [
      this.store.select(closeGenerationFeature.selectQuartierId),
      this.store.select(selectProposals),
    ]),
    switchMap(([{ key, reverse }, quartierId, proposals]) => {
      const proposal = proposals.find((p) => p.key === key);
      if (!quartierId || !proposal) {
        return of(CloseGenerationActions.openNumberingFailure({
          errorMessageKey: 'closes.generation.errorProposalGone',
        }));
      }
      return this.api.previewProposedCloseNumbering(
        quartierId,
        {
          streetId: proposal.streetId,
          number: proposal.number,
          code: proposal.code,
          blocIds: proposal.blocs.map((b) => b.id),
          numbering: null,
        },
        reverse,
      ).pipe(
        map((numbering) => CloseGenerationActions.openNumberingSuccess({ key, numbering })),
        catchError((err) => of(CloseGenerationActions.openNumberingFailure({ errorMessageKey: toKey(err) }))),
      );
    }),
  ));

  renameStreet$ = createEffect(() => this.actions$.pipe(
    ofType(CloseGenerationActions.renameStreet),
    switchMap(({ street, name }) => this.api.renameStreet(street, name).pipe(
      map((updated) => CloseGenerationActions.renameStreetSuccess({ street: updated })),
      catchError((err) => of(CloseGenerationActions.renameStreetFailure({ errorMessageKey: toKey(err) }))),
    )),
  ));
}
