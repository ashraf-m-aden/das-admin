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
