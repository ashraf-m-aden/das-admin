import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AddressingApiPort } from './addressing-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PendingBlockSuggestion,
  PendingStreetSuggestion,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

/**
 * Implémentation réelle. Endpoints attendus (guide d'intégration §3.4/§3.5) :
 *   GET   /blocs?onlyUnnamed=&search=                     -> BlockToName[]
 *   POST  /blocs/{id}/name                                 -> BlockToName (saisie admin directe : crée + approuve une suggestion)
 *   GET   /blocs/suggestions?status=Pending                -> PendingBlockSuggestion[]
 *   POST  /blocs/suggestions/{id}/approve                  -> BlocSuggestionResponse (pas le bloc — rechargez la liste)
 *   POST  /blocs/suggestions/{id}/reject { rejectionReason } -> idem
 *   GET   /streets?onlyUnnamed=&search=                    -> StreetToName[]
 *   POST  /streets/{id}/name                                -> StreetToName
 *   GET   /streets/suggestions?status=Pending               -> PendingStreetSuggestion[]
 *   POST  /streets/suggestions/{id}/approve                 -> StreetSuggestionResponse
 *   POST  /streets/suggestions/{id}/reject { rejectionReason } -> idem
 *   GET   /addressing/properties-to-number?blockId=         -> PropertyToNumber[]
 *   PATCH /addressing/properties/{id}/house-number            -> PropertyToNumber
 */
@Injectable({ providedIn: 'root' })
export class AddressingApiService extends AddressingApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return this.config.get('apiBaseUrl');
  }

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    const params: Record<string, string> = { onlyUnnamed: String(query.onlyUnnamed) };
    if (query.search) params['search'] = query.search;
    return this.http.get<BlockToName[]>(`${this.baseUrl}/blocs`, { params });
  }

  override setBlockName(id: UUID, name: string): Observable<BlockToName> {
    return this.http.post<BlockToName>(`${this.baseUrl}/blocs/${id}/name`, { name });
  }

  override approveBlockSuggestion(suggestionId: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/blocs/suggestions/${suggestionId}/approve`, {}).pipe(map(() => undefined));
  }

  override rejectBlockSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    return this.http
      .post(`${this.baseUrl}/blocs/suggestions/${suggestionId}/reject`, { rejectionReason })
      .pipe(map(() => undefined));
  }

  override listPendingBlockSuggestions(): Observable<PendingBlockSuggestion[]> {
    return this.http.get<PendingBlockSuggestion[]>(`${this.baseUrl}/blocs/suggestions`, { params: { status: 'Pending' } });
  }

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const params: Record<string, string> = { onlyUnnamed: String(query.onlyUnnamed) };
    if (query.search) params['search'] = query.search;
    return this.http.get<StreetToName[]>(`${this.baseUrl}/streets`, { params });
  }

  override setStreetName(id: UUID, name: string): Observable<StreetToName> {
    return this.http.post<StreetToName>(`${this.baseUrl}/streets/${id}/name`, { name });
  }

  override approveStreetSuggestion(suggestionId: UUID): Observable<void> {
    return this.http.post(`${this.baseUrl}/streets/suggestions/${suggestionId}/approve`, {}).pipe(map(() => undefined));
  }

  override rejectStreetSuggestion(suggestionId: UUID, rejectionReason: string): Observable<void> {
    return this.http
      .post(`${this.baseUrl}/streets/suggestions/${suggestionId}/reject`, { rejectionReason })
      .pipe(map(() => undefined));
  }

  override listPendingStreetSuggestions(): Observable<PendingStreetSuggestion[]> {
    return this.http.get<PendingStreetSuggestion[]>(`${this.baseUrl}/streets/suggestions`, { params: { status: 'Pending' } });
  }

  override listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]> {
    const params: Record<string, string> = {};
    if (query.blockId) params['blockId'] = query.blockId;
    return this.http.get<PropertyToNumber[]>(`${this.baseUrl}/addressing/properties-to-number`, { params });
  }

  override assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber> {
    return this.http.patch<PropertyToNumber>(`${this.baseUrl}/addressing/properties/${id}/house-number`, payload);
  }
}
