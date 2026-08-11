import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegistryApiPort } from './registry-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, BulkUpdatePayload, RegistryFilterOptions,
  RegistryPageResult, RegistryQuery, RegistrySummary,
} from '../models/registry.models';

@Injectable({ providedIn: 'root' })
export class RegistryApiService extends RegistryApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl(): string { return `${this.config.get('apiBaseUrl')}/registry`; }

  override summary(): Observable<RegistrySummary> { return this.http.get<RegistrySummary>(`${this.baseUrl}/summary`); }
  override filterOptions(): Observable<RegistryFilterOptions> { return this.http.get<RegistryFilterOptions>(`${this.baseUrl}/filters`); }
  override list(query: RegistryQuery): Observable<RegistryPageResult> {
    return this.http.post<RegistryPageResult>(`${this.baseUrl}/search`, query);
  }
  override getDetail(id: UUID): Observable<AddressDetail> { return this.http.get<AddressDetail>(`${this.baseUrl}/${id}`); }
  override approve(ids: UUID[]): Observable<void> { return this.http.post<void>(`${this.baseUrl}/approve`, { ids }); }
  override bulkUpdate(payload: BulkUpdatePayload): Observable<void> { return this.http.patch<void>(`${this.baseUrl}/bulk`, payload); }
  override flagForReview(id: UUID): Observable<void> { return this.http.post<void>(`${this.baseUrl}/${id}/flag`, {}); }
}
