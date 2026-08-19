import { createSelector } from '@ngrx/store';
import { blocksFeature } from './blocks.reducer';

export const selectIsBlocksListLoading = createSelector(
  blocksFeature.selectListStatus,
  (status) => status === 'loading',
);

export const selectIsBlockDetailLoading = createSelector(
  blocksFeature.selectDetailStatus,
  (status) => status === 'loading',
);
