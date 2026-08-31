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

    /**
     * Un chargement remet l'onglet sur « Toutes » : on ouvre une campagne sur l'ensemble de sa
     * production, pas sur le filtre laissé par la campagne consultée juste avant.
     */
    /**
     * La liste n'est PAS vidée ici et l'onglet n'est PAS réinitialisé : ce chargement se rejoue
     * après chaque décision. Vider ferait clignoter la liste, et revenir sur « Toutes » ferait
     * perdre à l'opérateur le filtre sur lequel il travaille — au moment précis où il vient
     * d'agir. Le passage d'une campagne à l'autre, lui, est couvert par `clearCampaignSurveys`
     * au départ de l'écran.
     */
    on(ReviewActions.loadCampaignSurveys, (state, { campaignId }) => ({
      ...state,
      campaignSurveysCampaignId: campaignId,
      isCampaignSurveysLoading: true,
      campaignSurveysErrorMessageKey: null,
    })),
    on(ReviewActions.clearCampaignSurveys, (state) => ({
      ...state, campaignSurveys: [], campaignSurveysCampaignId: null, campaignSurveyStatus: null,
    })),
    on(ReviewActions.setCampaignSurveyStatus, (state, { status }) => ({ ...state, campaignSurveyStatus: status })),
    on(ReviewActions.loadCampaignSurveysSuccess, (state, { items, typeOccupationOptions, etatOccupationOptions }) => ({
      ...state,
      campaignSurveys: items,
      typeOccupationOptions,
      etatOccupationOptions,
      isCampaignSurveysLoading: false,
    })),
    on(ReviewActions.loadCampaignSurveysFailure, (state, { errorMessageKey }) => ({
      ...state,
      // Liste vidée : garder les relevés du filtre précédent sous un onglet qui a échoué
      // afficherait des lignes qui ne correspondent plus à ce qui est demandé.
      campaignSurveys: [],
      isCampaignSurveysLoading: false,
      campaignSurveysErrorMessageKey: errorMessageKey,
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
  selectCampaignSurveys,
  selectCampaignSurveysCampaignId,
  selectCampaignSurveyStatus,
  selectIsCampaignSurveysLoading,
  selectCampaignSurveysErrorMessageKey,
  selectCurrentSurveys,
  selectIsCurrentSurveysLoading,
  selectCurrentSurveysErrorMessageKey,
} = reviewFeature;
