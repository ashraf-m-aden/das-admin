import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ReviewApiPort } from './review-api.port';
import { RejectPayload, ReviewItem, ReviewQueueQuery } from '../models/review.models';
import { RedoSubmissionType, UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class MockReviewApiService extends ReviewApiPort {
  private static readonly SIMULATED_LATENCY_MS = 450;

  private items: ReviewItem[] = [
    {
      id: 'review-property-0001',
      submissionType: 'property',
      code: 'DJ-BOU-ARR2-Q7-B012-A-045',
      submittedByName: 'Idriss Agent',
      submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'submitted',
      gpsAccuracy: 4.2,
      photos: [
        { id: 'photo-0001', photoType: 'building_front', s3Key: 'demo/building_front.jpg' },
        { id: 'photo-0002', photoType: 'door', s3Key: 'demo/door.jpg' },
        { id: 'photo-0003', photoType: 'house_number_plate', s3Key: 'demo/plate.jpg' },
      ],
      notes: null,
    },
    {
      id: 'review-property-0002',
      submissionType: 'property',
      code: 'DJ-BOU-ARR2-Q3-B014-B-012',
      submittedByName: 'Idriss Agent',
      submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      status: 'submitted',
      gpsAccuracy: 18.7,
      photos: [{ id: 'photo-0004', photoType: 'building_front', s3Key: 'demo/building_front2.jpg' }],
      notes: 'Accès difficile, façade partiellement masquée par un mur.',
    },
    {
      id: 'review-street-0001',
      submissionType: 'street',
      code: 'Rue suggérée : "Avenue de la Paix"',
      submittedByName: 'Warsama Robleh',
      submittedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      status: 'submitted',
      gpsAccuracy: null,
      photos: [{ id: 'photo-0005', photoType: 'sign', s3Key: 'demo/sign.jpg' }],
      notes: null,
    },
  ];

  override listQueue(query: ReviewQueueQuery): Observable<ReviewItem[]> {
    const filtered = this.items.filter(
      (i) => i.status === 'submitted' && (!query.submissionType || i.submissionType === query.submissionType),
    );
    return of(filtered).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override approve(id: UUID, submissionType: RedoSubmissionType): Observable<ReviewItem> {
    const item = this.items.find((i) => i.id === id && i.submissionType === submissionType);
    if (!item) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: ReviewItem = { ...item, status: 'approved' };
    this.items = this.items.map((i) => (i.id === id ? updated : i));

    return of(updated).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }

  override reject(id: UUID, submissionType: RedoSubmissionType, payload: RejectPayload): Observable<ReviewItem> {
    const item = this.items.find((i) => i.id === id && i.submissionType === submissionType);
    if (!item) {
      return throwError(() => ({ code: 'not_found', message: 'common.error' }));
    }

    const updated: ReviewItem = { ...item, status: 'needs_redo', notes: payload.reason };
    this.items = this.items.map((i) => (i.id === id ? updated : i));

    return of(updated).pipe(delay(MockReviewApiService.SIMULATED_LATENCY_MS));
  }
}
