import { UUID, ISODateTime } from '../../models/das.models';
import { NotSurveyableReason, SurveyOutcome } from '../../review/models/review.models';

/** Un relevé signalé par `GET /api/surveys/suspicious`. */
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
  reasons: string[];
}

/** Volume de relevés remontés après clôture, par agent — le signal porte sur le volume, pas la ligne individuelle. */
export interface AgentPushVolumeItem {
  agentId: UUID;
  agentFullName: string;
  pushedAfterClose: number;
}

export interface SuspiciousSurveysData {
  surveys: SuspiciousSurveyItem[];
  pushedAfterCloseByAgent: AgentPushVolumeItem[];
}
