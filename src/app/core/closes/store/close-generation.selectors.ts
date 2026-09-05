import { createSelector } from '@ngrx/store';
import { closeGenerationFeature } from './close-generation.reducer';
import { applyEdit } from './close-generation.state';
import { ProposedClose } from '../models/closes.models';

/**
 * Les propositions telles qu'elles sont APRÈS relecture, les écartées retirées.
 *
 * C'est cette liste que l'écran affiche et que la confirmation enverra : jamais `plan.proposed`
 * brut, qui est ce que la machine avait proposé avant que l'opérateur y touche.
 */
export const selectProposals = createSelector(
  closeGenerationFeature.selectPlan,
  closeGenerationFeature.selectEdits,
  closeGenerationFeature.selectDiscardedKeys,
  (plan, edits, discarded): ProposedClose[] =>
    (plan?.proposed ?? [])
      .filter((p) => !discarded.includes(p.key))
      .map((p) => applyEdit(p, edits[p.key]))
      // Une proposition vidée de tous ses blocs n'a plus d'objet : elle disparaît sans qu'on ait
      // à l'écarter explicitement.
      .filter((p) => p.blocs.length > 0),
);

export const selectDiscardedProposals = createSelector(
  closeGenerationFeature.selectPlan,
  closeGenerationFeature.selectDiscardedKeys,
  (plan, discarded): ProposedClose[] => (plan?.proposed ?? []).filter((p) => discarded.includes(p.key)),
);

/**
 * Compteurs recalculés sur les propositions RELUES, pas sur `plan.summary` — celui-ci décrit ce
 * que la machine avait proposé, et cesse d'être vrai dès le premier retrait de bloc.
 */
export const selectReviewSummary = createSelector(
  selectProposals,
  closeGenerationFeature.selectPlan,
  closeGenerationFeature.selectReviewedKeys,
  (proposals, plan, reviewed) => {
    const collisions = proposals.filter((p) => p.hasNumeroCollision);
    return {
      closes: proposals.length,
      blocs: proposals.reduce((n, p) => n + p.blocs.length, 0),
      adresses: proposals.reduce((n, p) => n + p.adresseCount, 0),
      unassignedBlocs: plan?.unassignedBlocs.length ?? 0,
      /** Closes qui exigent un plan de numérotation relu avant toute écriture. */
      needingReview: collisions.length,
      pendingReview: collisions.filter((p) => !reviewed.includes(p.key)).length,
      overCap: proposals.filter((p) => p.warnings.includes('ExceedsAddressCap')).length,
      unnamedStreets: proposals.filter((p) => p.warnings.includes('UnnamedStreet')).length,
    };
  },
);

/**
 * Ce qui empêcherait de confirmer. La confirmation elle-même n'est pas encore branchée — cette
 * liste existe pour que l'écran dise DÈS MAINTENANT ce qui manque, plutôt que de le découvrir
 * au moment d'écrire.
 */
export const selectBlockers = createSelector(
  selectProposals,
  selectReviewSummary,
  (proposals, summary): string[] => {
    const blockers: string[] = [];
    if (proposals.length === 0) blockers.push('closes.generation.blockerNoProposal');
    if (summary.pendingReview > 0) blockers.push('closes.generation.blockerPendingReview');
    if (summary.overCap > 0) blockers.push('closes.generation.blockerOverCap');
    const codes = proposals.map((p) => p.code);
    if (new Set(codes).size !== codes.length) blockers.push('closes.generation.blockerDuplicateCode');
    const numbers = proposals.map((p) => p.number);
    if (new Set(numbers).size !== numbers.length) blockers.push('closes.generation.blockerDuplicateNumber');
    const streets = proposals.map((p) => p.streetId);
    if (new Set(streets).size !== streets.length) blockers.push('closes.generation.blockerDuplicateStreet');
    return blockers;
  },
);

/** Plan de numérotation avec les corrections manuelles appliquées — c'est lui qu'on relit. */
export const selectEffectiveNumbering = createSelector(
  closeGenerationFeature.selectNumbering,
  closeGenerationFeature.selectNumberingEdits,
  (plan, edits) => {
    if (!plan) return null;
    if (Object.keys(edits).length === 0) return plan;
    const adresses = plan.adresses
      .map((a) => (edits[a.adresseId] !== undefined ? { ...a, proposedNumero: edits[a.adresseId] } : a))
      .sort((a, b) => a.proposedNumero - b.proposedNumero);
    return {
      ...plan,
      adresses,
      changedCount: adresses.filter((a) => a.currentNumero !== a.proposedNumero).length,
    };
  },
);

/** Numéros en double dans le plan corrigé : un plan qui en porte serait refusé à l'écriture. */
export const selectNumberingIssues = createSelector(selectEffectiveNumbering, (plan): number[] => {
  if (!plan) return [];
  const seen = new Map<number, number>();
  for (const a of plan.adresses) seen.set(a.proposedNumero, (seen.get(a.proposedNumero) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([numero]) => numero).sort((a, b) => a - b);
});

export const selectIsProgressLoading = createSelector(
  closeGenerationFeature.selectProgressStatus,
  (status) => status === 'loading',
);
