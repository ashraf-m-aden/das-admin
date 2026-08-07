import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientsApiPort } from './clients-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  ApiTokenItem,
  ClientListItem,
  ClientListQuery,
  CreateApiTokenPayload,
  CreateApiTokenResult,
  CreateClientPayload,
  CreateClientResult,
  GrantZoneAccessPayload,
  SubscriptionPlanOption,
  UpdateClientPayload,
  ZoneAccessItem,
  ZoneOption,
} from '../models/clients.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET    /clients?search=&status=              -> ClientListItem[]
 *   GET    /clients/{id}                          -> ClientListItem
 *   POST   /clients                                -> CreateClientResult
 *   PATCH  /clients/{id}                           -> ClientListItem
 *   PATCH  /clients/{id}/enabled                   -> ClientListItem
 *   GET    /subscription-plans                     -> SubscriptionPlanOption[]
 *   GET    /clients/{id}/zone-access                -> ZoneAccessItem[]
 *   GET    /zones                                   -> ZoneOption[]
 *   POST   /clients/{id}/zone-access                -> ZoneAccessItem
 *   DELETE /clients/{id}/zone-access/{zoneAccessId} -> ZoneAccessItem (status='blocked')
 *   GET    /clients/{id}/api-token                  -> ApiTokenItem | null (un seul jeton)
 *   POST   /clients/{id}/api-token                  -> CreateApiTokenResult (révoque l'ancien automatiquement)
 *   DELETE /clients/{id}/api-token                  -> 204
 */
@Injectable({ providedIn: 'root' })
export class ClientsApiService extends ClientsApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return this.config.get('apiBaseUrl');
  }

  override list(query: ClientListQuery): Observable<ClientListItem[]> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    return this.http.get<ClientListItem[]>(`${this.baseUrl}/clients`, { params });
  }

  override getById(id: UUID): Observable<ClientListItem> {
    return this.http.get<ClientListItem>(`${this.baseUrl}/clients/${id}`);
  }

  override create(payload: CreateClientPayload): Observable<CreateClientResult> {
    return this.http.post<CreateClientResult>(`${this.baseUrl}/clients`, payload);
  }

  override update(id: UUID, payload: UpdateClientPayload): Observable<ClientListItem> {
    return this.http.patch<ClientListItem>(`${this.baseUrl}/clients/${id}`, payload);
  }

  override setEnabled(id: UUID, enabled: boolean): Observable<ClientListItem> {
    return this.http.patch<ClientListItem>(`${this.baseUrl}/clients/${id}/enabled`, { enabled });
  }

  override listPlans(): Observable<SubscriptionPlanOption[]> {
    return this.http.get<SubscriptionPlanOption[]>(`${this.baseUrl}/subscription-plans`);
  }

  override listZoneAccess(clientId: UUID): Observable<ZoneAccessItem[]> {
    return this.http.get<ZoneAccessItem[]>(`${this.baseUrl}/clients/${clientId}/zone-access`);
  }

  override listAvailableZones(): Observable<ZoneOption[]> {
    return this.http.get<ZoneOption[]>(`${this.baseUrl}/zones`);
  }

  override grantZoneAccess(clientId: UUID, payload: GrantZoneAccessPayload): Observable<ZoneAccessItem> {
    return this.http.post<ZoneAccessItem>(`${this.baseUrl}/clients/${clientId}/zone-access`, payload);
  }

  override revokeZoneAccess(clientId: UUID, zoneAccessId: UUID): Observable<ZoneAccessItem> {
    return this.http.delete<ZoneAccessItem>(`${this.baseUrl}/clients/${clientId}/zone-access/${zoneAccessId}`);
  }

  override getApiToken(clientId: UUID): Observable<ApiTokenItem | null> {
    return this.http.get<ApiTokenItem | null>(`${this.baseUrl}/clients/${clientId}/api-token`);
  }

  override regenerateApiToken(clientId: UUID, payload: CreateApiTokenPayload): Observable<CreateApiTokenResult> {
    return this.http.post<CreateApiTokenResult>(`${this.baseUrl}/clients/${clientId}/api-token`, payload);
  }

  override revokeApiToken(clientId: UUID): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/clients/${clientId}/api-token`);
  }
}
