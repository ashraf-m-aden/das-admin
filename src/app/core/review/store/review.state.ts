import { RedoSubmissionType, UUID } from '../../models/das.models';
import { CampaignSurveyFilter, CampaignSurveyItem, CurrentSurveyItem, ReviewItem, ReviewPhoto, StalledSurveyItem } from '../models/review.models';
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

  /**
   * Production d'UNE campagne (`GET /api/surveys?campaignId=`), lue depuis le détail de campagne.
   * Séparée de `items` : la file de décision est multi-campagnes et bornée à `Submitted`, les
   * deux listes ne se remplacent donc jamais l'une l'autre.
   */
  campaignSurveys: CampaignSurveyItem[];
  /**
   * Campagne actuellement lue, `null` hors de cet écran. Retenue pour une seule raison :
   * après une décision, la liste doit se relire — sinon un relevé validé garde sa pastille
   * « Soumis » jusqu'à un rechargement manuel. `null` en dehors évite qu'une décision prise
   * dans la file de vérification déclenche un appel pour un écran qu'on ne regarde plus.
   */
  campaignSurveysCampaignId: UUID | null;
  /**
   * Onglet courant. Porte un `CampaignSurveyFilter` et non un `SurveyStatus` : « Validé
   * (provisoire) » est un filtre d'écran, pas un statut serveur.
   */
  campaignSurveyStatus: CampaignSurveyFilter | null;
  isCampaignSurveysLoading: boolean;
  campaignSurveysErrorMessageKey: string | null;

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

  campaignSurveys: [],
  campaignSurveysCampaignId: null,
  campaignSurveyStatus: null,
  isCampaignSurveysLoading: false,
  campaignSurveysErrorMessageKey: null,

  currentSurveys: [],
  isCurrentSurveysLoading: false,
  currentSurveysErrorMessageKey: null,
};
