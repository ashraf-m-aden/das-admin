import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DataQualityApiPort } from './dataquality-api.port';
import { UUID } from '../../models/das.models';
import { AppConfigService } from '../../config/app-config.service';
import { AgentPushVolumeItem, SuspiciousSurveyItem, SuspiciousSurveysData } from '../models/dataquality.models';
import { NotSurveyableReason, SurveyOutcome } from '../../review/models/review.models';

/** Forme brute de `SurveyResponse` — seuls les champs utiles à la file anti-fraude. */
interface RawSurveyResponse {
  id: string;
  adresseId: string;
  agentId: string;
  outcome: SurveyOutcome;
  notSurveyableReason: NotSurveyableReason | null;
  distanceFromAddressM: number | string | null;
  gpsAccuracyM: number | string | null;
  isMockLocation: boolean;
  photoCount: number | string;
  capturedAtUtc: string;
  agentFullName?: string | null;
  adresseLibelle?: string | null;
  quartierNom?: string | null;
  suspicionDismissedAtUtc?: string | null;
  suspicionDismissReason?: string | null;
}

interface RawSuspiciousReason {
  code: string;
  args: Record<string, number>;
}

interface RawSuspiciousSurveyResponse {
  survey: RawSurveyResponse;
  reasons: RawSuspiciousReason[];
}

interface RawAgentPushVolumeResponse {
  agentId: string;
  agentFullName: string;
  pushedAfterClose: number | string;
}

interface RawSuspiciousSurveysResponse {
  surveys: RawSuspiciousSurveyResponse[];
  pushedAfterCloseByAgent: RawAgentPushVolumeResponse[];
  suspiciousDistanceM?: number | string;
}

function toSuspiciousSurveyItem(raw: RawSuspiciousSurveyResponse): SuspiciousSurveyItem {
  const s = raw.survey;
  return {
    id: s.id,
    adresseId: s.adresseId,
    agentId: s.agentId,
    outcome: s.outcome,
    notSurveyableReason: s.notSurveyableReason,
    capturedAtUtc: s.capturedAtUtc,
    distanceFromAddressM: s.distanceFromAddressM === null ? null : Number(s.distanceFromAddressM),
    gpsAccuracyM: s.gpsAccuracyM === null ? null : Number(s.gpsAccuracyM),
    isMockLocation: s.isMockLocation,
    photoCount: Number(s.photoCount),
    // `args` peut manquer sur un motif sans paramètre : un objet vide évite un garde
    // à chaque interpolation côté gabarit.
    reasons: raw.reasons.map((r) => ({ code: r.code, args: r.args ?? {} })),
    agentFullName: s.agentFullName ?? null,
    adresseLibelle: s.adresseLibelle ?? null,
    quartierNom: s.quartierNom ?? null,
    suspicionDismissedAtUtc: s.suspicionDismissedAtUtc ?? null,
    suspicionDismissReason: s.suspicionDismissReason ?? null,
  };
}

function toAgentPushVolumeItem(raw: RawAgentPushVolumeResponse): AgentPushVolumeItem {
  return { agentId: raw.agentId, agentFullName: raw.agentFullName, pushedAfterClose: Number(raw.pushedAfterClose) };
}

@Injectable({ providedIn: 'root' })
export class DataQualityApiService extends DataQualityApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get suspiciousUrl() { return `${this.config.get('apiBaseUrl')}/surveys/suspicious`; }

  override dismissSuspicion(surveyId: UUID, reason: string): Observable<void> {
    return this.http
      .post(`${this.config.get('apiBaseUrl')}/surveys/${surveyId}/dismiss-suspicion`, { reason })
      .pipe(map(() => undefined));
  }

  override load(includeDismissed: boolean): Observable<SuspiciousSurveysData> {
    const params: Record<string, boolean> = includeDismissed ? { includeDismissed: true } : {};
    return this.http.get<RawSuspiciousSurveysResponse>(this.suspiciousUrl, { params }).pipe(
      map((raw) => ({
        surveys: raw.surveys.map(toSuspiciousSurveyItem),
        pushedAfterCloseByAgent: raw.pushedAfterCloseByAgent.map(toAgentPushVolumeItem),
        // Repli à 100 seulement si un back antérieur ne renvoie pas le champ — il ne doit
        // pas devenir la valeur de référence.
        suspiciousDistanceM: raw.suspiciousDistanceM === undefined ? 100 : Number(raw.suspiciousDistanceM),
      })),
    );
  }
}
