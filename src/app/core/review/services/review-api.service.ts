import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReviewApiPort } from './review-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { RejectPayload, ReviewItem, ReviewQueueQuery } from '../models/review.models';
import { RedoSubmissionType, UUID } from '../../models/das.models';

@Injectable({ providedIn: 'root' })
export class ReviewApiService extends ReviewApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/review`; }

  override listQueue(query: ReviewQueueQuery): Observable<ReviewItem[]> {
    const params: Record<string, string> = {};
    if (query.submissionType) params['submissionType'] = query.submissionType;
    return this.http.get<ReviewItem[]>(`${this.baseUrl}/queue`, { params });
  }

  override approve(id: UUID, submissionType: RedoSubmissionType): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.baseUrl}/${submissionType}/${id}/approve`, {});
  }

  override reject(id: UUID, submissionType: RedoSubmissionType, payload: RejectPayload): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.baseUrl}/${submissionType}/${id}/reject`, payload);
  }

  // ⚠ Endpoint ABSENT de la spec actuelle — à implémenter côté backend.
  override requestResurvey(id: UUID, submissionType: RedoSubmissionType): Observable<ReviewItem> {
    return this.http.post<ReviewItem>(`${this.baseUrl}/${submissionType}/${id}/resurvey`, {});
  }
}
