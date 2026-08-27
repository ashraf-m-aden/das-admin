import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { AdresseSurvey, CurrentSurveyItem, ReviewPhoto, StalledSurveyItem, SurveyReviewItem } from '../models/review.models';

/** Ne couvre que les relevés (`/api/surveys`) — les suggestions de nom passent par AddressingApiPort. */
export abstract class ReviewApiPort {
  abstract listSubmittedSurveys(): Observable<SurveyReviewItem[]>;
  abstract validateSurvey(id: UUID): Observable<void>;
  abstract rejectSurvey(id: UUID, rejectionReason: string): Observable<void>;
  abstract requestSurveyCorrection(id: UUID): Observable<void>;
  abstract getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]>;
  /**
   * `GET /api/surveys?adresseId=` — tous les relevés d'une parcelle, tous statuts. Alimente
   * l'onglet Photos du tiroir. Les photos ne sont PAS incluses : elles se demandent relevé par
   * relevé, chaque appel régénérant des URLs signées.
   */
  abstract listSurveysByAdresse(adresseId: UUID): Observable<AdresseSurvey[]>;
  /** Relevés d'une campagne clôturée jamais tranchés — signal d'alerte pour le Superviseur. */
  abstract listStalledSurveys(): Observable<StalledSurveyItem[]>;
  /** État terrain courant : dernier relevé validé par adresse, filtrable par bloc. */
  abstract listCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): Observable<CurrentSurveyItem[]>;
}
