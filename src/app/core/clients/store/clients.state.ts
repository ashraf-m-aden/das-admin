import { ClientStatus } from '../../models/das.models';
import {
  ApiTokenItem,
  ClientListItem,
  SubscriptionPlanOption,
  ZoneAccessItem,
  ZoneOption,
} from '../models/clients.models';

export type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type SavingStatus = 'idle' | 'saving' | 'error';

export interface ClientFilters {
  search: string;
  status: ClientStatus | null;
}

export interface ClientsState {
  items: ClientListItem[];
  listStatus: ListStatus;
  listErrorMessageKey: string | null;
  filters: ClientFilters;

  plans: SubscriptionPlanOption[];

  formStatus: SavingStatus;
  formErrorMessageKey: string | null;
  lastCreatedTemporaryPassword: string | null;

  zoneAccess: ZoneAccessItem[];
  zoneAccessStatus: ListStatus;
  availableZones: ZoneOption[];
  zoneAccessErrorMessageKey: string | null;

  apiToken: ApiTokenItem | null;
  apiTokenStatus: ListStatus;
  isSavingToken: boolean;
  apiTokenErrorMessageKey: string | null;
  lastCreatedRawToken: string | null;
}

export const initialClientsState: ClientsState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { search: '', status: null },

  plans: [],

  formStatus: 'idle',
  formErrorMessageKey: null,
  lastCreatedTemporaryPassword: null,

  zoneAccess: [],
  zoneAccessStatus: 'idle',
  availableZones: [],
  zoneAccessErrorMessageKey: null,

  apiToken: null,
  apiTokenStatus: 'idle',
  isSavingToken: false,
  apiTokenErrorMessageKey: null,
  lastCreatedRawToken: null,
};
