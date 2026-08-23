import { createSelector } from '@ngrx/store';
import { closesFeature } from './closes.reducer';
import { UUID } from '../../models/das.models';
import { Close } from '../models/closes.models';

export const selectIsListLoading = createSelector(closesFeature.selectListStatus, (s) => s === 'loading');

/**
 * `blocId → close propriétaire`. Un bloc n'appartient qu'à UNE close : cette table est ce qui
 * permet de griser un bloc déjà pris et de refuser de le voler à une autre close.
 */
export const selectBlocOwner = createSelector(
  closesFeature.selectCloses,
  (closes) => {
    const owner = new Map<UUID, Close>();
    for (const c of closes) {
      for (const b of c.blocIds) owner.set(b, c);
    }
    return owner;
  },
);

/** Numéros déjà pris dans le quartier — `(QuartierId, Number)` est unique (cf. adressage.md §2.3). */
export const selectTakenNumbers = createSelector(
  closesFeature.selectCloses,
  (closes) => new Map<number, Close>(closes.map((c) => [c.number, c])),
);
