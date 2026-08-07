import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ReviewActions } from './review.actions';
import { reviewFeature } from './review.reducer';
import { selectIsDeciding, selectIsReviewListLoading } from './review.selectors';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { RejectPayload } from '../models/review.models';
import { ReviewFilters } from './review.state';

@Injectable({ providedIn: 'root' })
export class ReviewFacade {
  private store = inject(Store);

  items$ = this.store.select(reviewFeature.selectItems);
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

  approve(id: UUID, submissionType: RedoSubmissionType): void {
    this.store.dispatch(ReviewActions.approve({ id, submissionType }));
  }

  reject(id: UUID, submissionType: RedoSubmissionType, payload: RejectPayload): void {
    this.store.dispatch(ReviewActions.reject({ id, submissionType, payload }));
  }
}
