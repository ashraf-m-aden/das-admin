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
  /**
   * Identité du relevé, ajoutée au contrat le 2026-08-28.
   *
   * Avant, la file affichait un relevé à valider ou rejeter **sans dire lequel ni de qui** :
   * `SurveyResponse` ne portait que `adresseId` et `agentId`, deux UUID. Ces trois champs
   * sont `null` sur les réponses d'ÉCRITURE (création, rejet), qui renvoient un relevé dont
   * l'appelant connaît déjà le contexte.
   */
  agentFullName: string | null;
  adresseLibelle: string | null;
  addressCode: string | null;
  quartierNom: string | null;
  /**
   * Les DEUX points nécessaires pour juger l'écart : où l'agent a capturé, et où est la
   * parcelle. `distanceFromAddressM` seul ne dit pas si le releveur était dans la rue d'à côté
   * ou dans le bâtiment voisin.
   */
  gpsCaptureWkt: string | null;
  adresseLocationWkt: string | null;
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
  /**
   * Vignette, `null` pour les photos antérieures au 2026-08-30 qui n'en ont pas.
   *
   * Le back la renvoyait depuis le 2026-08-30 et le front la **jetait** : la galerie chargeait
   * des photos pleines pour afficher des vignettes de 60×46 px. C'est exactement le coût que
   * les vignettes existent pour éviter — le back-office doit rester utilisable sur une
   * connexion djiboutienne. Repli sur `readUrl` quand elle manque.
   */
  thumbnailUrl: string | null;
  uploadedAtUtc: ISODateTime;
}

/**
 * Issue d'une validation (`POST /api/surveys/{id}/validate`, corps `{ validationType }`).
 *
 * ⚠️ **`Definitive` fige le `addressCode` de la parcelle et la sort du périmètre des campagnes
 * suivantes — c'est irréversible côté données.** Côté back, `ValidationType` est un enum C#
 * dont `Definitive` est le PREMIER membre, donc sa valeur par défaut : un corps vide (`{}`)
 * est désérialisé en `Definitive` et passe le garde `Enum.IsDefined`. Ne jamais laisser le
 * back choisir pour l'opérateur — la valeur part toujours explicitement.
 */
export type ValidationType = 'Definitive' | 'Temporary';

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

/**
 * Un relevé d'une campagne, TOUS STATUTS (`GET /api/surveys?campaignId=&status=`).
 *
 * Ni la file de décision (`SurveyReviewItem`, bornée à `Submitted`) ni l'historique d'une
 * parcelle (`AdresseSurvey`, borné à une adresse) ne répondaient à la question posée depuis le
 * détail de campagne : « les 2 brouillons annoncés par l'avancement, ils portent sur quoi ? ».
 * D'où ce troisième axe de lecture — par campagne — qui porte le `status` en plus des faits.
 */
export interface CampaignSurveyItem extends SurveyReviewItem {
  status: SurveyStatus;
  /**
   * Portée de la validation — `null` tant que le relevé n'est pas validé. Ajoutée au contrat
   * le 2026-08-31 : sans elle, un `Temporary` était indistinguable d'un `Definitive` à
   * l'écran, alors que le premier attend un recontrôle et le second est définitif.
   */
  validationType: ValidationType | null;
  /** Renseigné sur un relevé rejeté : c'est le message que l'agent a reçu. */
  rejectionReason: string | null;
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
