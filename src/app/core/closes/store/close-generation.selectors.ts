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
    // Le plafond de 99 adresses n'est PLUS un bloqueur : tranché le 2026-09-06, il peut être
    // dépassé au besoin. Il reste signalé par proposition (`ExceedsAddressCap`), ce qui suffit —
    // en faire un verrou empêchait de confirmer 56 closes sur 531 sans recours.

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

/**
 * Les totaux de la confirmation générale. Calculés ici plutôt que dans le gabarit : c'est sur ces
 * chiffres qu'on décide d'écrire, et une somme cachée dans une interpolation ne se relit pas.
 *
 * `numeroCollisions` mérite l'attention : ce sont les closes dont les numéros devront être
 * acceptés tels que le serveur les propose, faute de relecture individuelle.
 */
export const selectBulkTotals = createSelector(
  closeGenerationFeature.selectBulk,
  (bulk) => {
    const t = bulk.outcomes.reduce((acc, o) => ({
      quartiers: acc.quartiers + (o.closesProposed > 0 ? 1 : 0),
      closes: acc.closes + o.closesProposed,
      adresses: acc.adresses + o.adressesImpacted,
      blocsUnassigned: acc.blocsUnassigned + o.blocsUnassigned,
      numeroCollisions: acc.numeroCollisions + o.withNumeroCollision,
      overCap: acc.overCap + o.overCap,
      closesCreated: acc.closesCreated + o.closesCreated,
      adressesRenumbered: acc.adressesRenumbered + o.adressesRenumbered,
      echecs: acc.echecs + (o.status === 'failed' ? 1 : 0),
    }), {
      quartiers: 0, closes: 0, adresses: 0, blocsUnassigned: 0,
      numeroCollisions: 0, overCap: 0, closesCreated: 0, adressesRenumbered: 0, echecs: 0,
    });

    return { ...t, recenses: bulk.outcomes.length };
  },
);
