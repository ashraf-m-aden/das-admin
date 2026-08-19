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

  /**
   * Ressource backend = /adresses (l'entité domaine réelle).
   * Le préfixe /registry appartenait au vocabulaire de l'écran, pas à la ressource ;
   * le nom interne « registry » (module, facade, composant) reste inchangé côté front.
   */
  private get baseUrl(): string { return `${this.config.get('apiBaseUrl')}/adresses`; }

  override summary(): Observable<RegistrySummary> { return this.http.get<RegistrySummary>(`${this.baseUrl}/summary`); }
  override filterOptions(): Observable<RegistryFilterOptions> { return this.http.get<RegistryFilterOptions>(`${this.baseUrl}/filter-options`); }
  override list(query: RegistryQuery): Observable<RegistryPageResult> {
    return this.http.post<RegistryPageResult>(`${this.baseUrl}/search`, query);
  }
  override getDetail(id: UUID): Observable<AddressDetail> { return this.http.get<AddressDetail>(`${this.baseUrl}/${id}`); }
  override bulkUpdate(payload: BulkUpdatePayload): Observable<void> { return this.http.patch<void>(`${this.baseUrl}/bulk`, payload); }
}
