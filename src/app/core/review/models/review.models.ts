import { UUID, ISODateTime } from '../../models/das.models';

export type SurveyOutcome = 'Surveyed' | 'NotSurveyable';
export type NotSurveyableReason = 'Demolished' | 'Inaccessible' | 'Refused' | 'NotFound' | 'VacantLand' | 'OutOfTime';

/** Un relevé soumis (`GET /api/surveys?status=Submitted`) — pas de nom d'agent ni de code adresse : l'API ne renvoie que des ids. */
export interface SurveyReviewItem {
  submissionType: 'property';
  id: UUID;
  adresseId: UUID;
  agentId: UUID;
  capturedAtUtc: ISODateTime;
  outcome: SurveyOutcome;
  notSurveyableReason: NotSurveyableReason | null;
  typeOccupationId: UUID | null;
  etatOccupationId: UUID | null;
  name: string | null;
  floorCount: number;
  apartmentCount: number;
  shopCount: number;
  wheelchairAccessible: boolean;
  gpsAccuracyM: number | null;
  distanceFromAddressM: number | null;
  photoCount: number;
  isMockLocation: boolean;
}

/** Une suggestion de nom de bloc ou de rue en attente (`GET /api/{blocs,streets}/suggestions?status=Pending`). */
export interface SuggestionReviewItem {
  submissionType: 'street' | 'block';
  id: UUID;
  /** blocId ou streetId visé — pas envoyé au back sur la décision, l'id de la suggestion suffit. */
  targetId: UUID;
  suggestedName: string;
  comment: string | null;
  proposedAtUtc: ISODateTime;
}

export type ReviewItem = SurveyReviewItem | SuggestionReviewItem;

export interface ReviewPhoto {
  id: UUID;
  /**
   * URL de lecture **signée et à durée limitée**, régénérée à chaque appel et jamais stockée
   * côté back (seule `objectKey` l'est). Deux conséquences : elle ne se met pas en cache et ne
   * se met pas en favori — une URL rejouée plus tard renverra 403, ce n'est pas un bug.
   */
  readUrl: string;
  uploadedAtUtc: ISODateTime;
}

export type SurveyStatus = 'Draft' | 'Submitted' | 'Validated' | 'Rejected';

/**
 * Relevé d'une adresse donnée, avec ses photos — c'est la trace du passage de l'agent terrain.
 *
 * Distinct de `SurveyReviewItem` : celui-là est une FILE DE DÉCISION (`?status=Submitted`), ici
 * on lit l'historique d'UNE parcelle, tous statuts confondus, y compris les rejets. Un relevé
 * rejeté est précisément ce qu'on veut voir dans la fiche : il explique pourquoi la parcelle est
 * retombée en `registered`.
 */
export interface AdresseSurvey {
  id: UUID;
  adresseId: UUID;
  agentId: UUID;
  status: SurveyStatus;
  outcome: SurveyOutcome;
  notSurveyableReason: NotSurveyableReason | null;
  capturedAtUtc: ISODateTime;
  photoCount: number;
  rejectionReason: string | null;
  /** Rempli par l'effet, via `getSurveyPhotos`. Vide si l'appel a échoué — jamais bloquant. */
  photos: ReviewPhoto[];
}

/** Relevé soumis d'une campagne clôturée, jamais tranché (`GET /api/surveys/stalled`). */
export interface StalledSurveyItem {
  surveyId: UUID;
  adresseId: UUID;
  agentId: UUID;
  agentFullName: string;
  campaignId: UUID;
  campaignCode: string;
  capturedAtUtc: ISODateTime;
  /** Depuis combien de jours le relevé attend une décision — c'est le chiffre qui alerte. */
  daysWaiting: number;
}

/** Dernier relevé validé d'une adresse (`GET /api/surveys/current`) — état terrain courant, pas la file de décision. */
export interface CurrentSurveyItem {
  id: UUID;
  adresseId: UUID;
  outcome: SurveyOutcome;
  notSurveyableReason: NotSurveyableReason | null;
  typeOccupationId: UUID | null;
  etatOccupationId: UUID | null;
  capturedAtUtc: ISODateTime;
}
