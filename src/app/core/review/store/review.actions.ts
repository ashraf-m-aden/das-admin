import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { RejectPayload, ReviewItem } from '../models/review.models';
import { ReviewFilters } from './review.state';

export const ReviewActions = createActionGroup({
  source: 'Review',
  events: {
    'Load Queue': emptyProps(),
    'Load Queue Success': props<{ items: ReviewItem[] }>(),
    'Load Queue Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<ReviewFilters> }>(),

    Approve: props<{ id: UUID; submissionType: RedoSubmissionType }>(),
    'Approve Success': props<{ item: ReviewItem }>(),
    'Approve Failure': props<{ errorMessageKey: string }>(),

    Reject: props<{ id: UUID; submissionType: RedoSubmissionType; payload: RejectPayload }>(),
    'Reject Success': props<{ item: ReviewItem }>(),
    'Reject Failure': props<{ errorMessageKey: string }>(),

    'Request Resurvey': props<{ id: UUID; submissionType: RedoSubmissionType }>(),
    'Request Resurvey Success': props<{ item: ReviewItem }>(),
    'Request Resurvey Failure': props<{ errorMessageKey: string }>(),
  },
});
