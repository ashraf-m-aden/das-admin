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
} from './review.selectors';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { ReviewFilters } from './review.state';

@Injectable({ providedIn: 'root' })
export class ReviewFacade {
  private store = inject(Store);

  items$ = this.store.select(selectFilteredItems);
  filters$ = this.store.select(reviewFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsReviewListLoading);
  listErrorMessageKey$ = this.store.select(reviewFeature.selectListErrorMessageKey);
  decisionErrorMessageKey$ = this.store.select(reviewFeature.selectDecisionErrorMessageKey);

  load(): void {
    this.store.dispatch(ReviewActions.loadQueue());
  }

  setFilters(filters: Partial<ReviewFilters>): void {
    this.store.dispatch(ReviewActions.setFilters({ filters }));
  }

  isDeciding$(id: UUID) {
    return this.store.select(selectIsDeciding(id));
  }

  validate(id: UUID): void {
    this.store.dispatch(ReviewActions.validate({ id }));
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
}
