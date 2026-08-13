import { AddressWorkflowStage } from '../../models/das.models';
import { AddressDetail, AddressListItem, RegistryFilterOptions, RegistryFilters, RegistrySummary } from '../models/registry.models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface RegistryState {
  summary: RegistrySummary | null;
  summaryStatus: LoadStatus;
  items: AddressListItem[];
  total: number;
  page: number;
  pageSize: number;
  listStatus: LoadStatus;
  filters: RegistryFilters;
  filterOptions: RegistryFilterOptions;
  selectedIds: string[];
  detailOpenId: string | null;
  detail: AddressDetail | null;
  detailStatus: LoadStatus;
  isMutating: boolean;
}

export const initialRegistryFilters: RegistryFilters = {
  search: '', postcode: null, region: null, status: null as AddressWorkflowStage | null, team: null,
  zone: null
};

export const initialRegistryState: RegistryState = {
  summary: null,
  summaryStatus: 'idle',
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  listStatus: 'idle',
  filters: initialRegistryFilters,
  filterOptions: {
    postcodes: [], regions: [], teams: [],
    zones: []
  },
  selectedIds: [],
  detailOpenId: null,
  detail: null,
  detailStatus: 'idle',
  isMutating: false,
};
