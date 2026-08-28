import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ReviewApiPort } from './review-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { AdresseSurvey, CurrentSurveyItem, ReviewPhoto, StalledSurveyItem, SurveyReviewItem } from '../models/review.models';
import { UUID } from '../../models/das.models';

/** Forme brute de `SurveyResponse` (guide §4.4 / OpenAPI) — seuls les champs utiles à la file de validation. */
interface RawSurveyResponse {
  id: string;
  adresseId: string;
  agentId: string;
  outcome: 'Surveyed' | 'NotSurveyable';
  notSurveyableReason: 'Demolished' | 'Inaccessible' | 'Refused' | 'NotFound' | 'VacantLand' | 'OutOfTime' | null;
  typeOccupationId: string | null;
  etatOccupationId: string | null;
  name: string | null;
  floorCount: number | string;
  apartmentCount: number | string;
  shopCount: number | string;
  wheelchairAccessible: boolean;
  gpsAccuracyM: number | string | null;
  distanceFromAddressM: number | string | null;
  photoCount: number | string;
  isMockLocation: boolean;
  capturedAtUtc: string;
  status: 'Draft' | 'Submitted' | 'Validated' | 'Rejected';
  rejectionReason: string | null;
  // Optionnels : le back ne les renseigne que sur les réponses de LECTURE.
  agentFullName?: string | null;
  adresseLibelle?: string | null;
  addressCode?: string | null;
  quartierNom?: string | null;
  gpsCaptureWkt?: string | null;
  adresseLocationWkt?: string | null;
}

interface RawSurveyPhotoResponse {
  id: string;
  readUrl: string;
  uploadedAtUtc: string;
}

/** Forme brute de `StalledSurveyResponse` (`GET /api/surveys/stalled`). */
interface RawStalledSurveyResponse {
  surveyId: string;
  adresseId: string;
  agentId: string;
  agentFullName: string;
  campaignId: string;
  campaignCode: string;
  capturedAtUtc: string;
  daysWaiting: number | string;
}

function toStalledSurveyItem(raw: RawStalledSurveyResponse): StalledSurveyItem {
  return {
    surveyId: raw.surveyId,
    adresseId: raw.adresseId,
    agentId: raw.agentId,
    agentFullName: raw.agentFullName,
    campaignId: raw.campaignId,
    campaignCode: raw.campaignCode,
    capturedAtUtc: raw.capturedAtUtc,
    daysWaiting: Number(raw.daysWaiting),
  };
}

function toCurrentSurveyItem(raw: RawSurveyResponse): CurrentSurveyItem {
  return {
    id: raw.id,
    adresseId: raw.adresseId,
    outcome: raw.outcome,
    notSurveyableReason: raw.notSurveyableReason,
    typeOccupationId: raw.typeOccupationId,
    etatOccupationId: raw.etatOccupationId,
    capturedAtUtc: raw.capturedAtUtc,
  };
}

function toAdresseSurvey(raw: RawSurveyResponse): AdresseSurvey {
  return {
    id: raw.id,
    adresseId: raw.adresseId,
    agentId: raw.agentId,
    status: raw.status,
    outcome: raw.outcome,
    notSurveyableReason: raw.notSurveyableReason,
    capturedAtUtc: raw.capturedAtUtc,
    photoCount: Number(raw.photoCount),
    rejectionReason: raw.rejectionReason,
    photos: [],
  };
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
    typeOccupationId: raw.typeOccupationId,
    etatOccupationId: raw.etatOccupationId,
    name: raw.name,
    floorCount: Number(raw.floorCount),
    apartmentCount: Number(raw.apartmentCount),
    shopCount: Number(raw.shopCount),
    wheelchairAccessible: raw.wheelchairAccessible,
    gpsAccuracyM: raw.gpsAccuracyM === null ? null : Number(raw.gpsAccuracyM),
    distanceFromAddressM: raw.distanceFromAddressM === null ? null : Number(raw.distanceFromAddressM),
    photoCount: Number(raw.photoCount),
    isMockLocation: raw.isMockLocation,
    // `?? null` et non `?? ''` : un contexte absent est une information (réponse d'écriture),
    // pas une chaîne vide à afficher.
    agentFullName: raw.agentFullName ?? null,
    adresseLibelle: raw.adresseLibelle ?? null,
    addressCode: raw.addressCode ?? null,
    quartierNom: raw.quartierNom ?? null,
    gpsCaptureWkt: raw.gpsCaptureWkt ?? null,
    adresseLocationWkt: raw.adresseLocationWkt ?? null,
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

  override listSurveysByAdresse(adresseId: UUID): Observable<AdresseSurvey[]> {
    return this.http
      .get<RawSurveyResponse[]>(this.baseUrl, { params: { adresseId } })
      // Plus récent d'abord : c'est le dernier relevé qui détermine l'étape de la parcelle.
      .pipe(map((items) => items.map(toAdresseSurvey)
        .sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc))));
  }

  override listStalledSurveys(): Observable<StalledSurveyItem[]> {
    return this.http
      .get<RawStalledSurveyResponse[]>(`${this.baseUrl}/stalled`)
      .pipe(map((items) => items.map(toStalledSurveyItem)));
  }

  override listCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): Observable<CurrentSurveyItem[]> {
    const params: Record<string, string> = { surveyedOnly: String(surveyedOnly) };
    if (blocId) params['blocId'] = blocId;
    return this.http
      .get<RawSurveyResponse[]>(`${this.baseUrl}/current`, { params })
      .pipe(map((items) => items.map(toCurrentSurveyItem)));
  }
}
