import { RedoSubmissionType, UUID } from '../../models/das.models';
import { ReviewItem, ReviewPhoto } from '../models/review.models';
import { OccupationCatalogItem } from '../../reference/models/reference.models';

export type ReviewListStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ReviewFilters {
  submissionType: RedoSubmissionType | null;
}

export interface ReviewState {
  items: ReviewItem[];
  listStatus: ReviewListStatus;
  listErrorMessageKey: string | null;
  filters: ReviewFilters;
  decidingId: UUID | null;
  decisionErrorMessageKey: string | null;
  photosBySurveyId: Record<UUID, ReviewPhoto[]>;
  loadingPhotosId: UUID | null;
  /** Catalogues seedés au démarrage, chargés une fois avec la file (résolution du libellé de `typeOccupationId`/`etatOccupationId`). */
  typeOccupationOptions: OccupationCatalogItem[];
  etatOccupationOptions: OccupationCatalogItem[];
}

export const initialReviewState: ReviewState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { submissionType: null },
  decidingId: null,
  decisionErrorMessageKey: null,
  photosBySurveyId: {},
  loadingPhotosId: null,
  typeOccupationOptions: [],
  etatOccupationOptions: [],
};
