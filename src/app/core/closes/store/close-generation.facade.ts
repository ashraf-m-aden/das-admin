import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { CloseGenerationActions } from './close-generation.actions';
import { closeGenerationFeature } from './close-generation.reducer';
import {
  selectBlockers, selectDiscardedProposals, selectEffectiveNumbering, selectIsProgressLoading,
  selectNumberingIssues, selectProposals, selectReviewSummary,
} from './close-generation.selectors';
import { UUID } from '../../models/das.models';
import { CloseStreetOption, QuartierClosePlanParameters } from '../models/closes.models';

/**
 * Façade de l'écran de génération des closes.
 *
 * ⚠️ **Pas de confirmation ici.** L'écriture (`applyQuartierCloses`) n'est volontairement pas
 * exposée tant que la règle du plafond de 99 adresses par close n'est pas tranchée : elle entre
 * en conflit avec l'index unique (quartier, rue), qui interdit de découper une rue desservant
 * plus de 99 adresses. 56 closes sur 531 sont concernées. Voir `docs/plans/generation-closes.md`.
 *
 * Tout le reste de l'écran fonctionne, et n'appelle que des routes qui n'écrivent rien.
 * `selectBlockers` calcule déjà ce qui empêcherait de confirmer, pour que l'écran le dise
 * maintenant plutôt qu'au moment d'écrire.
 */
@Injectable({ providedIn: 'root' })
export class CloseGenerationFacade {
  private store = inject(Store);

  progress$ = this.store.select(closeGenerationFeature.selectProgress);
  isProgressLoading$ = this.store.select(selectIsProgressLoading);
  quartierId$ = this.store.select(closeGenerationFeature.selectQuartierId);
  plan$ = this.store.select(closeGenerationFeature.selectPlan);
  isPreviewing$ = this.store.select(closeGenerationFeature.selectIsPreviewing);
  streets$ = this.store.select(closeGenerationFeature.selectStreets);
  errorMessageKey$ = this.store.select(closeGenerationFeature.selectErrorMessageKey);

  /** Propositions APRÈS relecture, écartées retirées. Jamais `plan.proposed` brut. */
  proposals$ = this.store.select(selectProposals);
  discardedProposals$ = this.store.select(selectDiscardedProposals);
  summary$ = this.store.select(selectReviewSummary);
  blockers$ = this.store.select(selectBlockers);
  reviewedKeys$ = this.store.select(closeGenerationFeature.selectReviewedKeys);

  numberingKey$ = this.store.select(closeGenerationFeature.selectNumberingKey);
  numbering$ = this.store.select(selectEffectiveNumbering);
  numberingIssues$ = this.store.select(selectNumberingIssues);
  numberingReverse$ = this.store.select(closeGenerationFeature.selectNumberingReverse);
  isNumbering$ = this.store.select(closeGenerationFeature.selectIsNumbering);

  loadProgress(): void { this.store.dispatch(CloseGenerationActions.loadProgress()); }
  loadStreets(): void { this.store.dispatch(CloseGenerationActions.loadStreets()); }

  selectQuartier(quartierId: UUID | null): void {
    this.store.dispatch(CloseGenerationActions.selectQuartier({ quartierId }));
  }

  /** Relance l'aperçu. Les corrections en cours sont perdues : le regroupement change. */
  setParameters(parameters: Partial<QuartierClosePlanParameters>): void {
    this.store.dispatch(CloseGenerationActions.setParameters({ parameters }));
  }

  refresh(): void { this.store.dispatch(CloseGenerationActions.preview()); }

  changeStreet(key: string, streetId: UUID): void {
    this.store.dispatch(CloseGenerationActions.changeStreet({ key, streetId }));
  }

  changeNumber(key: string, value: number): void {
    this.store.dispatch(CloseGenerationActions.changeNumber({ key, number: value }));
  }

  changeCode(key: string, code: string): void {
    this.store.dispatch(CloseGenerationActions.changeCode({ key, code }));
  }

  removeBloc(key: string, blocId: UUID): void {
    this.store.dispatch(CloseGenerationActions.removeBloc({ key, blocId }));
  }

  moveBloc(fromKey: string, toKey: string, blocId: UUID): void {
    this.store.dispatch(CloseGenerationActions.moveBloc({ fromKey, toKey, blocId }));
  }

  discard(key: string): void { this.store.dispatch(CloseGenerationActions.discardProposal({ key })); }
  restore(key: string): void { this.store.dispatch(CloseGenerationActions.restoreProposal({ key })); }

  /**
   * ⚠️ Une rue est PARTAGÉE : la nommer change le libellé de toutes ses closes, y compris dans
   * d'autres quartiers. C'est voulu — une rue n'a qu'un nom — mais ça dépasse l'écran.
   */
  renameStreet(street: CloseStreetOption, name: string): void {
    this.store.dispatch(CloseGenerationActions.renameStreet({ street, name }));
  }

  openNumbering(key: string, reverse = false): void {
    this.store.dispatch(CloseGenerationActions.openNumbering({ key, reverse }));
  }

  editPlannedNumero(adresseId: UUID, numero: number): void {
    this.store.dispatch(CloseGenerationActions.editPlannedNumero({ adresseId, numero }));
  }

  closeNumbering(): void { this.store.dispatch(CloseGenerationActions.closeNumbering()); }
  markReviewed(key: string): void { this.store.dispatch(CloseGenerationActions.markReviewed({ key })); }
  clearError(): void { this.store.dispatch(CloseGenerationActions.clearError()); }
}
