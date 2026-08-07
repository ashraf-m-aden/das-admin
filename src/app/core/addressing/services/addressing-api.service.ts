import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AddressingApiPort } from './addressing-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AssignBlockNamePayload,
  AssignHouseNumberPayload,
  AssignStreetNamePayload,
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET   /addressing/blocks-to-name?search=&onlyUnnamed=   -> BlockToName[]
 *   PATCH /addressing/blocks/{id}/name                      -> BlockToName
 *   GET   /addressing/streets-to-name?search=&onlyUnnamed=  -> StreetToName[]
 *   PATCH /addressing/streets/{id}/name                     -> StreetToName
 *   GET   /addressing/properties-to-number?blockId=          -> PropertyToNumber[]
 *   PATCH /addressing/properties/{id}/house-number            -> PropertyToNumber
 */
@Injectable({ providedIn: 'root' })
export class AddressingApiService extends AddressingApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/addressing`;
  }

  override listBlocksToName(query: BlockNamingQuery): Observable<BlockToName[]> {
    const params: Record<string, string> = { onlyUnnamed: String(query.onlyUnnamed) };
    if (query.search) params['search'] = query.search;
    return this.http.get<BlockToName[]>(`${this.baseUrl}/blocks-to-name`, { params });
  }

  override assignBlockName(id: UUID, payload: AssignBlockNamePayload): Observable<BlockToName> {
    return this.http.patch<BlockToName>(`${this.baseUrl}/blocks/${id}/name`, payload);
  }

  override listStreetsToName(query: StreetNamingQuery): Observable<StreetToName[]> {
    const params: Record<string, string> = { onlyUnnamed: String(query.onlyUnnamed) };
    if (query.search) params['search'] = query.search;
    return this.http.get<StreetToName[]>(`${this.baseUrl}/streets-to-name`, { params });
  }

  override assignStreetName(id: UUID, payload: AssignStreetNamePayload): Observable<StreetToName> {
    return this.http.patch<StreetToName>(`${this.baseUrl}/streets/${id}/name`, payload);
  }

  override listPropertiesToNumber(query: PropertyNumberingQuery): Observable<PropertyToNumber[]> {
    const params: Record<string, string> = {};
    if (query.blockId) params['blockId'] = query.blockId;
    return this.http.get<PropertyToNumber[]>(`${this.baseUrl}/properties-to-number`, { params });
  }

  override assignHouseNumber(id: UUID, payload: AssignHouseNumberPayload): Observable<PropertyToNumber> {
    return this.http.patch<PropertyToNumber>(`${this.baseUrl}/properties/${id}/house-number`, payload);
  }
}
