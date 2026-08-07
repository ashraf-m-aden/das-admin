import { UUID, ISODateTime, ClientStatus, ZoneAccessStatus } from '../../models/das.models';

export interface ClientListItem {
  id: UUID;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: ClientStatus;
  enabled: boolean;
  planId: UUID;
  planName: string;
  createdAt: ISODateTime;
}

export interface ClientListQuery {
  search: string;
  status: ClientStatus | null;
}

export interface SubscriptionPlanOption {
  id: UUID;
  name: string;
  maxZones: number;
}

export interface CreateClientPayload {
  companyName: string;
  contactName: string;
  login: string;
  email: string;
  phone: string | null;
  planId: UUID;
}

export type UpdateClientPayload = Omit<CreateClientPayload, 'login'>;

export interface CreateClientResult {
  client: ClientListItem;
  temporaryPassword: string;
}

export interface ZoneAccessItem {
  id: UUID;
  zoneId: UUID;
  zoneName: string;
  accessStatus: ZoneAccessStatus;
  grantedAt: ISODateTime;
}

export interface GrantZoneAccessPayload {
  zoneId: UUID;
}

export interface ZoneOption {
  id: UUID;
  name: string;
}

// --- Jeton API — un seul par client -----------------------------------------

export interface ApiTokenItem {
  id: UUID;
  name: string;
  scopes: string[];
  lastUsedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface CreateApiTokenPayload {
  name: string;
  scopes: string[];
}

export interface CreateApiTokenResult {
  token: ApiTokenItem;
  /** Valeur brute — affichée UNE SEULE FOIS, jamais récupérable ensuite. */
  rawToken: string;
}
