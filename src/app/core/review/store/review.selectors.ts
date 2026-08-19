import { createSelector } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import { reviewFeature } from './review.reducer';

export const selectIsReviewListLoading = createSelector(reviewFeature.selectListStatus, (s) => s === 'loading');

export const selectFilteredItems = createSelector(
  reviewFeature.selectItems,
  reviewFeature.selectFilters,
  (items, filters) => (filters.submissionType ? items.filter((i) => i.submissionType === filters.submissionType) : items),
);

export const selectIsDeciding = (id: UUID) => createSelector(reviewFeature.selectDecidingId, (decidingId) => decidingId === id);

export const selectPhotosFor = (surveyId: UUID) =>
  createSelector(reviewFeature.selectPhotosBySurveyId, (photosBySurveyId) => photosBySurveyId[surveyId] ?? null);

export const selectIsLoadingPhotos = (surveyId: UUID) =>
  createSelector(reviewFeature.selectLoadingPhotosId, (loadingId) => loadingId === surveyId);
