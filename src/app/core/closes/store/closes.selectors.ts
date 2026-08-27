import { createSelector } from '@ngrx/store';
import { closesFeature } from './closes.reducer';
import { UUID } from '../../models/das.models';
import { Close } from '../models/closes.models';

export const selectIsListLoading = createSelector(closesFeature.selectListStatus, (s) => s === 'loading');

/**
 * `blocId → close propriétaire`, dérivé directement de `Block.closeId` (source de vérité unique
 * depuis que le back l'expose) — pas des `blocIds` de chaque `Close`, pour ne pas dupliquer la
 * même information dans deux structures qui pourraient diverger.
 */
export const selectBlocOwner = createSelector(
  closesFeature.selectBlocs,
  closesFeature.selectCloses,
  (blocs, closes) => {
    const closeById = new Map(closes.map((c) => [c.id, c]));
    const owner = new Map<UUID, Close>();
    for (const b of blocs) {
      const close = b.closeId ? closeById.get(b.closeId) : undefined;
      if (close) owner.set(b.id, close);
    }
    return owner;
  },
);

/** Numéros déjà pris dans le quartier — `(QuartierId, Number)` est unique (cf. adressage-close.md §3). */
export const selectTakenNumbers = createSelector(
  closesFeature.selectCloses,
  (closes) => new Map<number, Close>(closes.map((c) => [c.number, c])),
);

/**
 * Le plan tel qu'il sera ENVOYÉ : proposition du serveur, écrasée par les corrections manuelles.
 *
 * ⚠️ **L'ordre du serveur est conservé tel quel, jamais retrié sur le numéro corrigé.** Retrier à
 * la volée faisait sauter la ligne qu'on est en train d'éditer : on tape « 5 », la ligne file en
 * cinquième position, et il faut courir après pour la corriger. L'ordre ne change donc qu'au
 * rechargement de l'aperçu (inversion du sens, bloc ajouté), où il est légitime qu'il change.
 *
 * Le serveur renvoie déjà ses parcelles triées par numéro proposé — c'est cet ordre-là qui est
 * l'ordre de parcours de la voie, celui que l'opérateur relit sur la carte.
 */
export const selectEffectivePlan = createSelector(
  closesFeature.selectPlan,
  closesFeature.selectPlanEdits,
  (plan, edits) => {
    if (!plan) return null;
    const adresses = plan.adresses.map((a) => ({ ...a, effectiveNumero: edits[a.adresseId] ?? a.proposedNumero }));
    return { ...plan, adresses };
  },
);

/**
 * Anomalies bloquantes, détectées AVANT l'envoi — le back les refuserait de toute façon
 * (`Closes.NumberingDuplicate`, `Closes.AddressCodeFrozen`), autant les montrer tout de suite
 * plutôt que de faire un aller-retour pour un 409.
 */
export const selectPlanIssues = createSelector(selectEffectivePlan, (plan) => {
  if (!plan) return { duplicates: [] as number[], frozen: [] as string[], outOfRange: [] as string[] };
  const counts = new Map<number, number>();
  for (const a of plan.adresses) counts.set(a.effectiveNumero, (counts.get(a.effectiveNumero) ?? 0) + 1);
  return {
    duplicates: [...counts.entries()].filter(([, n]) => n > 1).map(([num]) => num),
    // Un code figé interdit de changer le numéro : on ne signale que ceux qu'on ferait bouger.
    frozen: plan.adresses.filter((a) => a.addressCode && a.effectiveNumero !== a.currentNumero).map((a) => a.adresseId),
    outOfRange: plan.adresses.filter((a) => a.effectiveNumero < 1).map((a) => a.adresseId),
  };
});

export const selectCanApplyPlan = createSelector(selectPlanIssues, selectEffectivePlan, (issues, plan) =>
  !!plan && issues.duplicates.length === 0 && issues.frozen.length === 0 && issues.outOfRange.length === 0);
