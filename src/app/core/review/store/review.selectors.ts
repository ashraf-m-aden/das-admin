import { createSelector } from '@ngrx/store';
import { reviewFeature } from './review.reducer';

export const selectIsReviewListLoading = createSelector(
  reviewFeature.selectListStatus,
  (status) => status === 'loading',
);

export const selectIsDeciding = (id: string) =>
  createSelector(reviewFeature.selectDecidingId, (decidingId) => decidingId === id);
