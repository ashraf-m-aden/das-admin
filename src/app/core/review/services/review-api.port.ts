import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { AdresseSurvey, CampaignSurveyItem, CurrentSurveyItem, ReviewPhoto, StalledSurveyItem, SurveyReviewItem, ValidationType } from '../models/review.models';

/** Ne couvre que les relevés (`/api/surveys`) — les suggestions de nom passent par AddressingApiPort. */
export abstract class ReviewApiPort {
  abstract listSubmittedSurveys(): Observable<SurveyReviewItem[]>;
  /**
   * `POST /{id}/validate`, corps `{ validationType }`.
   *
   * Le type est un paramètre OBLIGATOIRE et sans valeur par défaut, volontairement : côté back
   * `ValidationType` est un enum dont `Definitive` est le premier membre, donc un corps vide y
   * gèle le `addressCode`. Un défaut ici — quel qu'il soit — remettrait ce choix hors de vue de
   * l'appelant, alors que c'est précisément la décision qu'il doit prendre.
   */
  abstract validateSurvey(id: UUID, validationType: ValidationType): Observable<void>;
  abstract rejectSurvey(id: UUID, rejectionReason: string): Observable<void>;
  abstract requestSurveyCorrection(id: UUID): Observable<void>;
  abstract getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]>;
  /**
   * `GET /api/surveys?adresseId=` — tous les relevés d'une parcelle, tous statuts. Alimente
   * l'onglet Photos du tiroir. Les photos ne sont PAS incluses : elles se demandent relevé par
   * relevé, chaque appel régénérant des URLs signées.
   */
  abstract listSurveysByAdresse(adresseId: UUID): Observable<AdresseSurvey[]>;
  /**
   * `GET /api/surveys?campaignId=` — TOUTE la production d'une campagne, tous statuts.
   *
   * C'est ce qui rend exploitables les compteurs de l'avancement : ils annonçaient
   * « 2 brouillons » sans qu'aucun écran ne puisse dire lesquels.
   *
   * Le filtre `?status=` existe mais n'est **délibérément pas utilisé** : les onglets de
   * l'écran comptent et filtrent la liste rapatriée. Un filtre serveur imposerait un appel par
   * onglet, et surtout des compteurs (venant de `progress`) qui peuvent contredire la liste
   * affichée — un « Brouillon 2 » au-dessus d'une liste vide, sans rien pour trancher.
   */
  abstract listCampaignSurveys(campaignId: UUID): Observable<CampaignSurveyItem[]>;
  /** Relevés d'une campagne clôturée jamais tranchés — signal d'alerte pour le Superviseur. */
  abstract listStalledSurveys(): Observable<StalledSurveyItem[]>;
  /** État terrain courant : dernier relevé validé par adresse, filtrable par bloc. */
  abstract listCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): Observable<CurrentSurveyItem[]>;
}
