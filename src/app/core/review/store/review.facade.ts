import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ReviewActions } from './review.actions';
import { reviewFeature } from './review.reducer';
import {
  selectFilteredItems,
  selectIsDeciding,
  selectIsLoadingPhotos,
  selectIsReviewListLoading,
  selectPhotosFor,
  selectFilteredCampaignSurveys,
  selectCampaignSurveyCounts,
} from './review.selectors';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { ReviewFilters } from './review.state';
import { CampaignSurveyFilter, ValidationType } from '../models/review.models';

@Injectable({ providedIn: 'root' })
export class ReviewFacade {
  private store = inject(Store);

  items$ = this.store.select(selectFilteredItems);
  filters$ = this.store.select(reviewFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsReviewListLoading);
  listErrorMessageKey$ = this.store.select(reviewFeature.selectListErrorMessageKey);
  decisionErrorMessageKey$ = this.store.select(reviewFeature.selectDecisionErrorMessageKey);
  typeOccupationOptions$ = this.store.select(reviewFeature.selectTypeOccupationOptions);
  etatOccupationOptions$ = this.store.select(reviewFeature.selectEtatOccupationOptions);

  load(): void {
    this.store.dispatch(ReviewActions.loadQueue());
  }

  setFilters(filters: Partial<ReviewFilters>): void {
    this.store.dispatch(ReviewActions.setFilters({ filters }));
  }

  isDeciding$(id: UUID) {
    return this.store.select(selectIsDeciding(id));
  }

  /** `validationType` explicite : `Definitive` fige le `addressCode`, ce n'est jamais un défaut. */
  validate(id: UUID, validationType: ValidationType): void {
    this.store.dispatch(ReviewActions.validate({ id, validationType }));
  }

  reject(id: UUID, submissionType: RedoSubmissionType, rejectionReason: string): void {
    this.store.dispatch(ReviewActions.reject({ id, submissionType, rejectionReason }));
  }

  requestCorrection(id: UUID): void {
    this.store.dispatch(ReviewActions.requestCorrection({ id }));
  }

  approveSuggestion(id: UUID, submissionType: 'block' | 'street'): void {
    this.store.dispatch(ReviewActions.approveSuggestion({ id, submissionType }));
  }

  loadPhotos(surveyId: UUID): void {
    this.store.dispatch(ReviewActions.loadPhotos({ surveyId }));
  }

  photosFor$(surveyId: UUID) {
    return this.store.select(selectPhotosFor(surveyId));
  }

  isLoadingPhotos$(surveyId: UUID) {
    return this.store.select(selectIsLoadingPhotos(surveyId));
  }

  stalledItems$ = this.store.select(reviewFeature.selectStalledItems);
  isStalledLoading$ = this.store.select(reviewFeature.selectIsStalledLoading);

  loadStalled(): void {
    this.store.dispatch(ReviewActions.loadStalled());
  }

  /** Liste réduite à l'onglet courant ; `campaignSurveyTotal$` reste le total, tous statuts. */
  campaignSurveys$ = this.store.select(selectFilteredCampaignSurveys);
  campaignSurveyCounts$ = this.store.select(selectCampaignSurveyCounts);
  campaignSurveyStatus$ = this.store.select(reviewFeature.selectCampaignSurveyStatus);
  isCampaignSurveysLoading$ = this.store.select(reviewFeature.selectIsCampaignSurveysLoading);
  campaignSurveysErrorMessageKey$ = this.store.select(reviewFeature.selectCampaignSurveysErrorMessageKey);

  /** Un seul appel par campagne : tous les relevés, tous statuts. Les onglets filtrent ensuite. */
  loadCampaignSurveys(campaignId: UUID): void {
    this.store.dispatch(ReviewActions.loadCampaignSurveys({ campaignId }));
  }

  /** À la fermeture de l'écran : aucune décision ultérieure ne doit plus recharger cette liste. */
  clearCampaignSurveys(): void {
    this.store.dispatch(ReviewActions.clearCampaignSurveys());
  }

  /** Onglet de statut — filtre d'affichage, pas de rechargement. */
  setCampaignSurveyStatus(status: CampaignSurveyFilter | null): void {
    this.store.dispatch(ReviewActions.setCampaignSurveyStatus({ status }));
  }

  currentSurveys$ = this.store.select(reviewFeature.selectCurrentSurveys);
  isCurrentSurveysLoading$ = this.store.select(reviewFeature.selectIsCurrentSurveysLoading);

  loadCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): void {
    this.store.dispatch(ReviewActions.loadCurrentSurveys({ blocId, surveyedOnly }));
  }
}
