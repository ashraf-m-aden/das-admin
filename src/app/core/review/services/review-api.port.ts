import { Observable } from 'rxjs';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { RejectPayload, ReviewItem, ReviewQueueQuery } from '../models/review.models';

export abstract class ReviewApiPort {
  abstract listQueue(query: ReviewQueueQuery): Observable<ReviewItem[]>;
  abstract approve(id: UUID, submissionType: RedoSubmissionType): Observable<ReviewItem>;
  abstract reject(id: UUID, submissionType: RedoSubmissionType, payload: RejectPayload): Observable<ReviewItem>;
}
