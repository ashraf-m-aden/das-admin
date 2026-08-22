import { RedoSubmissionType, UUID } from '../../models/das.models';
import { CurrentSurveyItem, ReviewItem, ReviewPhoto, StalledSurveyItem } from '../models/review.models';
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

  /** Relevés en souffrance (`GET /api/surveys/stalled`) — indépendant de la file de décision. */
  stalledItems: StalledSurveyItem[];
  isStalledLoading: boolean;
  stalledErrorMessageKey: string | null;

  /** État terrain courant (`GET /api/surveys/current`) — consommé depuis l'écran bloc, pas la file de décision. */
  currentSurveys: CurrentSurveyItem[];
  isCurrentSurveysLoading: boolean;
  currentSurveysErrorMessageKey: string | null;
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

  stalledItems: [],
  isStalledLoading: false,
  stalledErrorMessageKey: null,

  currentSurveys: [],
  isCurrentSurveysLoading: false,
  currentSurveysErrorMessageKey: null,
};
