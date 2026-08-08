import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AddressingApiPort } from './addressing-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AssignHouseNumberPayload,
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

/**
 * Implémentation réelle. Endpoints attendus (alignés sur BlocSuggestions/StreetSuggestions) :
 *   GET   /blocs?onlyUnnamed=&search=                        -> BlockToName[]
 *   POST  /blocs/{id}/name                                    -> BlockToName (saisie admin directe : crée + approuve une suggestion)
 *   PATCH /blocs/{id}/suggestions/{suggestionId}/approve      -> BlockToName
 *   PATCH /blocs/{id}/suggestions/{suggestionId}/reject       -> BlockToName (body: { reason })
 *   GET   /streets?onlyUnnamed=&search=                       -> StreetToName[]
 *   POST  /streets/{id}/name                                   -> StreetToName
 *   PATCH /streets/{id}/suggestions/{suggestionId}/approve    -> StreetToName
 *   PATCH /streets/{id}/suggestions/{suggestionId}/reject     -> StreetToName
 *   GET   /addressing/properties-to-number?blockId=            -> PropertyToNumber[]
 *   PATCH /addressing/properties/{id}/house-number              -> PropertyToNumber
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

  override approveBlockSuggestion(id: UUID, suggestionId: UUID): Observable<BlockToName> {
    return this.http.patch<BlockToName>(`${this.baseUrl}/blocs/${id}/suggestions/${suggestionId}/approve`, {});
  }

  override rejectBlockSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<BlockToName> {
    return this.http.patch<BlockToName>(`${this.baseUrl}/blocs/${id}/suggestions/${suggestionId}/reject`, { reason });
  }

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const params: Record<string, string> = { onlyUnnamed: String(query.onlyUnnamed) };
    if (query.search) params['search'] = query.search;
    return this.http.get<StreetToName[]>(`${this.baseUrl}/streets`, { params });
  }

  override setStreetName(id: UUID, name: string): Observable<StreetToName> {
    return this.http.post<StreetToName>(`${this.baseUrl}/streets/${id}/name`, { name });
  }

  override approveStreetSuggestion(id: UUID, suggestionId: UUID): Observable<StreetToName> {
    return this.http.patch<StreetToName>(`${this.baseUrl}/streets/${id}/suggestions/${suggestionId}/approve`, {});
  }

  override rejectStreetSuggestion(id: UUID, suggestionId: UUID, reason: string): Observable<StreetToName> {
    return this.http.patch<StreetToName>(`${this.baseUrl}/streets/${id}/suggestions/${suggestionId}/reject`, { reason });
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
