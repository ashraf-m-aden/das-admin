import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { ReviewItem, ReviewPhoto } from '../models/review.models';
import { ReviewFilters } from './review.state';
import { OccupationCatalogItem } from '../../reference/models/reference.models';

export const ReviewActions = createActionGroup({
  source: 'Review',
  events: {
    'Load Queue': emptyProps(),
    'Load Queue Success': props<{
      items: ReviewItem[];
      typeOccupationOptions: OccupationCatalogItem[];
      etatOccupationOptions: OccupationCatalogItem[];
    }>(),
    'Load Queue Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<ReviewFilters> }>(),

    Validate: props<{ id: UUID }>(),
    'Validate Success': props<{ id: UUID }>(),
    'Validate Failure': props<{ errorMessageKey: string }>(),

    Reject: props<{ id: UUID; submissionType: RedoSubmissionType; rejectionReason: string }>(),
    'Reject Success': props<{ id: UUID }>(),
    'Reject Failure': props<{ errorMessageKey: string }>(),

    'Request Correction': props<{ id: UUID }>(),
    'Request Correction Success': props<{ id: UUID }>(),
    'Request Correction Failure': props<{ errorMessageKey: string }>(),

    'Approve Suggestion': props<{ id: UUID; submissionType: 'block' | 'street' }>(),
    'Approve Suggestion Success': props<{ id: UUID }>(),
    'Approve Suggestion Failure': props<{ errorMessageKey: string }>(),

    'Load Photos': props<{ surveyId: UUID }>(),
    'Load Photos Success': props<{ surveyId: UUID; photos: ReviewPhoto[] }>(),
    'Load Photos Failure': props<{ surveyId: UUID; errorMessageKey: string }>(),
  },
});
