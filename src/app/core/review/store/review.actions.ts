import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { RedoSubmissionType, UUID } from '../../models/das.models';
import { CampaignSurveyItem, CurrentSurveyItem, ReviewItem, ReviewPhoto, StalledSurveyItem, SurveyStatus, ValidationType } from '../models/review.models';
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

    Validate: props<{ id: UUID; validationType: ValidationType }>(),
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

    'Load Stalled': emptyProps(),
    'Load Stalled Success': props<{ items: StalledSurveyItem[] }>(),
    'Load Stalled Failure': props<{ errorMessageKey: string }>(),

    'Load Campaign Surveys': props<{ campaignId: UUID }>(),
    'Load Campaign Surveys Success': props<{
      items: CampaignSurveyItem[];
      typeOccupationOptions: OccupationCatalogItem[];
      etatOccupationOptions: OccupationCatalogItem[];
    }>(),
    'Load Campaign Surveys Failure': props<{ errorMessageKey: string }>(),

    /** Onglet de statut de l'écran campagne. Pur filtre d'affichage : aucun appel réseau derrière. */
    'Set Campaign Survey Status': props<{ status: SurveyStatus | null }>(),

    /** L'écran campagne se ferme : plus aucune décision ne doit y déclencher de rechargement. */
    'Clear Campaign Surveys': emptyProps(),

    'Load Current Surveys': props<{ blocId: UUID | null; surveyedOnly: boolean }>(),
    'Load Current Surveys Success': props<{
      items: CurrentSurveyItem[];
      typeOccupationOptions: OccupationCatalogItem[];
      etatOccupationOptions: OccupationCatalogItem[];
    }>(),
    'Load Current Surveys Failure': props<{ errorMessageKey: string }>(),
  },
});
