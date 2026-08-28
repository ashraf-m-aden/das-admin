import { UUID, ISODateTime } from '../../models/das.models';
import { NotSurveyableReason, SurveyOutcome } from '../../review/models/review.models';

/** Un relevé signalé par `GET /api/surveys/suspicious`. */
/** Un signal, tel que le back le code. `args` porte les valeurs à interpoler dans le libellé. */
export interface SuspiciousReason {
  code: string;
  args: Record<string, number>;
}

export interface SuspiciousSurveyItem {
  id: UUID;
  adresseId: UUID;
  agentId: UUID;
  outcome: SurveyOutcome;
  notSurveyableReason: NotSurveyableReason | null;
  capturedAtUtc: ISODateTime;
  distanceFromAddressM: number | null;
  gpsAccuracyM: number | null;
  isMockLocation: boolean;
  photoCount: number;
  /** Phrases déjà composées côté back (chiffres interpolés) — affichées telles quelles, sans clé i18n. */
  /**
   * Signaux déclenchés, en CODES et paramètres — plus en phrases.
   *
   * Le back renvoyait du français rédigé (« Position GPS simulée signalée par l'appareil. »),
   * que l'écran anglais affichait tel quel. Le contrat porte désormais un code traduisible et
   * les valeurs à interpoler, non formatées : c'est le front qui connaît la langue.
   */
  reasons: SuspiciousReason[];
  /** Identité du relevé, comme dans la file de vérification. `null` si le back ne l'a pas renvoyée. */
  agentFullName: string | null;
  adresseLibelle: string | null;
  quartierNom: string | null;
  /**
   * Renseigné quand un superviseur a jugé les signaux acceptables.
   *
   * Écarter le SIGNAL n'est pas valider le RELEVÉ : le relevé reste à trancher dans la file
   * de vérification. Les deux décisions sont distinctes et prises sur deux écrans.
   */
  suspicionDismissedAtUtc: string | null;
  suspicionDismissReason: string | null;
}

/** Volume de relevés remontés après clôture, par agent — le signal porte sur le volume, pas la ligne individuelle. */
export interface AgentPushVolumeItem {
  agentId: UUID;
  agentFullName: string;
  pushedAfterClose: number;
}

export interface SuspiciousSurveysData {
  /** Seuil de distance réellement appliqué par le back. Le front l'affichait en dur à 100 m. */
  suspiciousDistanceM: number;
  surveys: SuspiciousSurveyItem[];
  pushedAfterCloseByAgent: AgentPushVolumeItem[];
}
