import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ReviewApiPort } from './review-api.port';
import { CurrentSurveyItem, ReviewPhoto, StalledSurveyItem, SurveyReviewItem } from '../models/review.models';
import { UUID } from '../../models/das.models';

/**
 * Agent dont les relevés sont, dans le mock, réputés être ceux du superviseur connecté. Il rend
 * `Surveys.SelfReview` atteignable sans back : c'est la faille `B1`, la seule règle de la file
 * de validation qu'un opérateur peut réellement déclencher, et elle serait autrement invisible
 * en `useMockApi`. Le vrai back compare l'auteur du relevé au `reviewerUserId` du jeton.
 */
const SELF_AGENT_ID = 'mock-surveyor-0002';

/** Forme d'erreur métier du mock : `{ code, message }` nu, sans enveloppe `.error` (cf. `core/http/error-code.ts`). */
const fail = (code: string, message: string): Observable<never> => throwError(() => ({ code, message }));

@Injectable({ providedIn: 'root' })
export class MockReviewApiService extends ReviewApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private surveys: SurveyReviewItem[] = [
    {
      submissionType: 'property',
      id: 'survey-0001',
      adresseId: 'addr-12346',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: 'etat-occ-bon',
      name: null,
      floorCount: 1,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: true,
      gpsAccuracyM: 4.2,
      distanceFromAddressM: 1.8,
      photoCount: 3,
      isMockLocation: false,
    },
    {
      submissionType: 'property',
      id: 'survey-0002',
      adresseId: 'addr-12351',
      agentId: 'mock-surveyor-0001',
      capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-immeuble',
      etatOccupationId: 'etat-occ-degrade',
      name: 'Résidence Al Amine',
      floorCount: 4,
      apartmentCount: 12,
      shopCount: 2,
      wheelchairAccessible: false,
      gpsAccuracyM: 18.7,
      distanceFromAddressM: 22.4,
      photoCount: 1,
      isMockLocation: true,
    },
    {
      submissionType: 'property',
      id: 'survey-0003',
      adresseId: 'addr-12356',
      agentId: 'mock-surveyor-0002',
      capturedAtUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      outcome: 'NotSurveyable',
      notSurveyableReason: 'Demolished',
      typeOccupationId: null,
      etatOccupationId: null,
      name: null,
      floorCount: 0,
      apartmentCount: 0,
      shopCount: 0,
      wheelchairAccessible: false,
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
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override rejectSurvey(id: UUID, rejectionReason: string): Observable<void> {
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override requestSurveyCorrection(id: UUID): Observable<void> {
    const refus = this.ensureReviewable(id);
    if (refus) return refus;
    this.surveys = this.surveys.filter((s) => s.id !== id);
    return of(undefined).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  /** Mêmes refus que `SurveyReview.EnsureReviewable`, dans le même ordre : introuvable, puis auto-validation. */
  private ensureReviewable(id: UUID): Observable<never> | null {
    const survey = this.surveys.find((s) => s.id === id);
    if (!survey) return fail('Surveys.NotFound', 'Relevé introuvable.');
    if (survey.agentId === SELF_AGENT_ID) {
      return fail('Surveys.SelfReview', 'Vous ne pouvez pas statuer sur votre propre relevé.');
    }
    return null;
  }

  override getSurveyPhotos(id: UUID): Observable<ReviewPhoto[]> {
    return of(this.photosBySurveyId[id] ?? []).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  private stalledSurveys: StalledSurveyItem[] = [
    {
      surveyId: 'survey-stalled-0001',
      adresseId: 'addr-12361',
      agentId: 'mock-surveyor-0002',
      agentFullName: 'Warsama Robleh',
      campaignId: 'campaign-0001',
      campaignCode: 'C2026-1',
      capturedAtUtc: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      daysWaiting: 12,
    },
  ];

  private currentSurveys: CurrentSurveyItem[] = [
    {
      id: 'survey-0001',
      adresseId: 'addr-12346',
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-villa',
      etatOccupationId: 'etat-occ-bon',
      capturedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'survey-0002',
      adresseId: 'addr-12351',
      outcome: 'Surveyed',
      notSurveyableReason: null,
      typeOccupationId: 'type-occ-immeuble',
      etatOccupationId: 'etat-occ-degrade',
      capturedAtUtc: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'survey-0003',
      adresseId: 'addr-12356',
      outcome: 'NotSurveyable',
      notSurveyableReason: 'Demolished',
      typeOccupationId: null,
      etatOccupationId: null,
      capturedAtUtc: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    },
  ];

  override listStalledSurveys(): Observable<StalledSurveyItem[]> {
    return of(this.stalledSurveys).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override listCurrentSurveys(blocId: UUID | null, surveyedOnly: boolean): Observable<CurrentSurveyItem[]> {
    const items = surveyedOnly ? this.currentSurveys.filter((s) => s.outcome === 'Surveyed') : this.currentSurveys;
    return of(items).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }
}
