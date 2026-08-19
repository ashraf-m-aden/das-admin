import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ReviewApiPort } from './review-api.port';
import { ReviewPhoto, SurveyReviewItem } from '../models/review.models';
import { UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockReviewApiService extends ReviewApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private surveys: SurveyReviewItem[] = [
    {
      submissionType: 'property',
      id: 'survey-0001',
      adresseId: 'adresse-0001',
      agentId: 'agent-idriss',
      capturedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      gpsAccuracyM: 4.2,
      distanceFromAddressM: 1.8,
      photoCount: 3,
      isMockLocation: false,
    },
    {
      submissionType: 'property',
      id: 'survey-0002',
      adresseId: 'adresse-0002',
      agentId: 'agent-idriss',
      capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      gpsAccuracyM: 18.7,
      distanceFromAddressM: 22.4,
      photoCount: 1,
      isMockLocation: true,
    },
    {
      submissionType: 'property',
      id: 'survey-0003',
      adresseId: 'adresse-0003',
      agentId: 'agent-warsama',
      capturedAtUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      outcome: 'NotSurveyable',
      notSurveyableReason: 'Demolished',
      gpsAccuracyM: 6.1,
      distanceFromAddressM: null,
      photoCount: 0,
      isMockLocation: false,
    },
  ];

  private photosBySurveyId: Record<UUID, ReviewPhoto[]> = {
    'survey-0001': [
      { id: 'photo-0001', readUrl: 'https://picsum.photos/seed/photo-0001/400/300', uploadedAtUtc: new Date().toISOString() },
      { id: 'photo-0002', readUrl: 'https://picsum.photos/seed/photo-0002/400/300', uploadedAtUtc: new Date().toISOString() },
      { id: 'photo-0003', readUrl: 'https://picsum.photos/seed/photo-0003/400/300', uploadedAtUtc: new Date().toISOString() },
    ],
    'survey-0002': [
      { id: 'photo-0004', readUrl: 'https://picsum.photos/seed/photo-0004/400/300', uploadedAtUtc: new Date().toISOString() },
    ],
  };

  override listSubmittedSurveys(): Observable<SurveyReviewItem[]> {
    return of(this.surveys).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override validateSurvey(id: UUID): Observable<void> {
    if (!this.surveys.some((s) => s.id === id)) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override rejectSurvey(id: UUID, rejectionReason: string): Observable<void> {
    if (!this.surveys.some((s) => s.id === id)) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override requestSurveyCorrection(id: UUID): Observable<void> {
    if (!this.surveys.some((s) => s.id === id)) return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]> {
    return of(this.photosBySurveyId[id] ?? []).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }
}
