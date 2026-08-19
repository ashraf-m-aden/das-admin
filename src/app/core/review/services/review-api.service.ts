import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ReviewApiPort } from './review-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { ReviewPhoto, SurveyReviewItem } from '../models/review.models';
import { UUID } from '../../models/das.models';

/** Forme brute de `SurveyResponse` (guide §4.4 / OpenAPI) — seuls les champs utiles à la file de validation. */
interface RawSurveyResponse {
  id: string;
  adresseId: string;
  agentId: string;
  outcome: 'Surveyed' | 'NotSurveyable';
  notSurveyableReason: 'Demolished' | 'Inaccessible' | 'Refused' | 'NotFound' | 'VacantLand' | 'OutOfTime' | null;
  gpsAccuracyM: number | string | null;
  distanceFromAddressM: number | string | null;
  photoCount: number | string;
  isMockLocation: boolean;
  capturedAtUtc: string;
}

interface RawSurveyPhotoResponse {
  id: string;
  readUrl: string;
  uploadedAtUtc: string;
}

function toSurveyReviewItem(raw: RawSurveyResponse): SurveyReviewItem {
  return {
    submissionType: 'property',
    id: raw.id,
    adresseId: raw.adresseId,
    agentId: raw.agentId,
    capturedAtUtc: raw.capturedAtUtc,
    outcome: raw.outcome,
    notSurveyableReason: raw.notSurveyableReason,
    gpsAccuracyM: raw.gpsAccuracyM === null ? null : Number(raw.gpsAccuracyM),
    distanceFromAddressM: raw.distanceFromAddressM === null ? null : Number(raw.distanceFromAddressM),
    photoCount: Number(raw.photoCount),
    isMockLocation: raw.isMockLocation,
  };
}

@Injectable({ providedIn: 'root' })
export class ReviewApiService extends ReviewApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/surveys`; }

  override listSubmittedSurveys(): Observable<SurveyReviewItem[]> {
    return this.http
      .get<RawSurveyResponse[]>(this.baseUrl, { params: { status: 'Submitted' } })
      .pipe(map((items) => items.map(toSurveyReviewItem)));
  }

  override validateSurvey(id: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/${id}/validate`, {}).pipe(map(() => undefined));
  }

  override rejectSurvey(id: UUID, rejectionReason: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/${id}/reject`, { rejectionReason }).pipe(map(() => undefined));
  }

  override requestSurveyCorrection(id: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/${id}/request-correction`, {}).pipe(map(() => undefined));
  }

  override getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]> {
    return this.http
      .get<RawSurveyPhotoResponse[]>(`${this.baseUrl}/${id}/photos`)
      .pipe(map((photos) => photos.map((p) => ({ id: p.id, readUrl: p.readUrl, uploadedAtUtc: p.uploadedAtUtc }))));
  }
}
