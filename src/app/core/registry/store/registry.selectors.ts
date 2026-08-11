import { createSelector } from '@ngrx/store';
import { registryFeature } from './registry.reducer';

export const selectIsListLoading = createSelector(registryFeature.selectListStatus, (s) => s === 'loading');
export const selectIsDetailLoading = createSelector(registryFeature.selectDetailStatus, (s) => s === 'loading');
export const selectSelectedCount = createSelector(registryFeature.selectSelectedIds, (ids) => ids.length);

export const selectPageInfo = createSelector(
  registryFeature.selectTotal, registryFeature.selectPage, registryFeature.selectPageSize,
  (total, page, pageSize) => {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    return { from, to, total, page, pageCount };
  },
);
