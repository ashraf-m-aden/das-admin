import { createFeature, createReducer, on } from '@ngrx/store';
import { ReviewActions } from './review.actions';
import { initialReviewState } from './review.state';

export const reviewFeature = createFeature({
  name: 'review',
  reducer: createReducer(
    initialReviewState,

    on(ReviewActions.loadQueue, (state) => ({
      ...state,
      listStatus: 'loading' as const,
      listErrorMessageKey: null,
    })),
    on(ReviewActions.loadQueueSuccess, (state, { items }) => ({
      ...state,
      items,
      listStatus: 'loaded' as const,
    })),
    on(ReviewActions.requestResurveySuccess, (state, { item }) => ({
      ...state,
      items: state.items.filter((i) => i.id !== item.id),
      isDeciding: false,
    })),
    on(ReviewActions.requestResurveyFailure, (state, { errorMessageKey }) => ({
      ...state,
      isDeciding: false,
      decisionErrorMessageKey: errorMessageKey,
    })),
    on(ReviewActions.loadQueueFailure, (state, { errorMessageKey }) => ({
      ...state,
      listStatus: 'error' as const,
      listErrorMessageKey: errorMessageKey,
    })),

    on(ReviewActions.setFilters, (state, { filters }) => ({
      ...state,
      filters: { ...state.filters, ...filters },
    })),

    on(ReviewActions.approve, ReviewActions.reject, (state, action) => ({
      ...state,
      decidingId: action.id,
      decisionErrorMessageKey: null,
    })),

    on(ReviewActions.approveSuccess, ReviewActions.rejectSuccess, (state, { item }) => ({
      ...state,
      items: state.items.filter((i) => i.id !== item.id),
      decidingId: null,
    })),

    on(ReviewActions.approveFailure, ReviewActions.rejectFailure, (state, { errorMessageKey }) => ({
      ...state,
      decidingId: null,
      decisionErrorMessageKey: errorMessageKey,
    })),
  ),
});

export const {
  name: reviewFeatureKey,
  reducer: reviewReducer,
  selectItems,
  selectListStatus,
  selectListErrorMessageKey,
  selectFilters,
  selectDecidingId,
  selectDecisionErrorMessageKey,
} = reviewFeature;
