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
  readUrl: string;
  uploadedAtUtc: ISODateTime;
}
