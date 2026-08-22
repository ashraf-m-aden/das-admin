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
    on(ReviewActions.loadQueueSuccess, (state, { items, typeOccupationOptions, etatOccupationOptions }) => ({
      ...state,
      items,
      typeOccupationOptions,
      etatOccupationOptions,
      listStatus: 'loaded' as const,
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

    on(
      ReviewActions.validate,
      ReviewActions.reject,
      ReviewActions.requestCorrection,
      ReviewActions.approveSuggestion,
      (state, action) => ({ ...state, decidingId: action.id, decisionErrorMessageKey: null }),
    ),

    on(
      ReviewActions.validateSuccess,
      ReviewActions.rejectSuccess,
      ReviewActions.requestCorrectionSuccess,
      ReviewActions.approveSuggestionSuccess,
      (state, { id }) => ({
        ...state,
        items: state.items.filter((i) => i.id !== id),
        decidingId: null,
      }),
    ),

    on(
      ReviewActions.validateFailure,
      ReviewActions.rejectFailure,
      ReviewActions.requestCorrectionFailure,
      ReviewActions.approveSuggestionFailure,
      (state, { errorMessageKey }) => ({
        ...state,
        decidingId: null,
        decisionErrorMessageKey: errorMessageKey,
      }),
    ),

    on(ReviewActions.loadPhotos, (state, { surveyId }) => ({ ...state, loadingPhotosId: surveyId })),
    on(ReviewActions.loadPhotosSuccess, (state, { surveyId, photos }) => ({
      ...state,
      photosBySurveyId: { ...state.photosBySurveyId, [surveyId]: photos },
      loadingPhotosId: null,
    })),
    on(ReviewActions.loadPhotosFailure, (state) => ({ ...state, loadingPhotosId: null })),

    on(ReviewActions.loadStalled, (state) => ({ ...state, isStalledLoading: true, stalledErrorMessageKey: null })),
    on(ReviewActions.loadStalledSuccess, (state, { items }) => ({
      ...state,
      stalledItems: items,
      isStalledLoading: false,
    })),
    on(ReviewActions.loadStalledFailure, (state, { errorMessageKey }) => ({
      ...state,
      isStalledLoading: false,
      stalledErrorMessageKey: errorMessageKey,
    })),

    on(ReviewActions.loadCurrentSurveys, (state) => ({
      ...state,
      isCurrentSurveysLoading: true,
      currentSurveysErrorMessageKey: null,
    })),
    on(ReviewActions.loadCurrentSurveysSuccess, (state, { items, typeOccupationOptions, etatOccupationOptions }) => ({
      ...state,
      currentSurveys: items,
      typeOccupationOptions,
      etatOccupationOptions,
      isCurrentSurveysLoading: false,
    })),
    on(ReviewActions.loadCurrentSurveysFailure, (state, { errorMessageKey }) => ({
      ...state,
      isCurrentSurveysLoading: false,
      currentSurveysErrorMessageKey: errorMessageKey,
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
  selectPhotosBySurveyId,
  selectLoadingPhotosId,
  selectTypeOccupationOptions,
  selectEtatOccupationOptions,
  selectStalledItems,
  selectIsStalledLoading,
  selectStalledErrorMessageKey,
  selectCurrentSurveys,
  selectIsCurrentSurveysLoading,
  selectCurrentSurveysErrorMessageKey,
} = reviewFeature;
