import { Observable } from 'rxjs';
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

export abstract class ClientsApiPort {
  abstract list(query: ClientListQuery): Observable<ClientListItem[]>;
  abstract getById(id: UUID): Observable<ClientListItem>;
  abstract create(payload: CreateClientPayload): Observable<CreateClientResult>;
  abstract update(id: UUID, payload: UpdateClientPayload): Observable<ClientListItem>;
  abstract setEnabled(id: UUID, enabled: boolean): Observable<ClientListItem>;
  abstract listPlans(): Observable<SubscriptionPlanOption[]>;

  abstract listZoneAccess(clientId: UUID): Observable<ZoneAccessItem[]>;
  abstract listAvailableZones(): Observable<ZoneOption[]>;
  abstract grantZoneAccess(clientId: UUID, payload: GrantZoneAccessPayload): Observable<ZoneAccessItem>;
  abstract revokeZoneAccess(clientId: UUID, zoneAccessId: UUID): Observable<ZoneAccessItem>;

  /** Un seul jeton par client — null si aucun n'a encore été généré. */
  abstract getApiToken(clientId: UUID): Observable<ApiTokenItem | null>;
  /** Génère un nouveau jeton — révoque automatiquement l'ancien côté backend s'il existait. */
  abstract regenerateApiToken(clientId: UUID, payload: CreateApiTokenPayload): Observable<CreateApiTokenResult>;
  abstract revokeApiToken(clientId: UUID): Observable<void>;
}
