import { createSelector } from '@ngrx/store';
import { adresseFeature } from './adresse.reducer';

export const selectIsListLoading = createSelector(adresseFeature.selectListStatus, (s) => s === 'loading');
export const selectIsDetailLoading = createSelector(adresseFeature.selectDetailStatus, (s) => s === 'loading');
export const selectSelectedCount = createSelector(adresseFeature.selectSelectedIds, (ids) => ids.length);

export const selectPageInfo = createSelector(
  adresseFeature.selectTotal, adresseFeature.selectPage, adresseFeature.selectPageSize,
  (total, page, pageSize) => {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    return { from, to, total, page, pageCount };
  },
);
