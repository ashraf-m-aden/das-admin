import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DataQualityApiPort } from './dataquality-api.port';
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
}

interface RawSuspiciousSurveyResponse {
  survey: RawSurveyResponse;
  reasons: string[];
}

interface RawAgentPushVolumeResponse {
  agentId: string;
  agentFullName: string;
  pushedAfterClose: number | string;
}

interface RawSuspiciousSurveysResponse {
  surveys: RawSuspiciousSurveyResponse[];
  pushedAfterCloseByAgent: RawAgentPushVolumeResponse[];
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
    reasons: raw.reasons,
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

  override load(): Observable<SuspiciousSurveysData> {
    return this.http.get<RawSuspiciousSurveysResponse>(this.suspiciousUrl).pipe(
      map((raw) => ({
        surveys: raw.surveys.map(toSuspiciousSurveyItem),
        pushedAfterCloseByAgent: raw.pushedAfterCloseByAgent.map(toAgentPushVolumeItem),
      })),
    );
  }
}
