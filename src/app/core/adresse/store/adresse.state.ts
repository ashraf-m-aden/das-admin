import { AddressWorkflowStage } from '../../models/das.models';
import { AddressDetail, AddressListItem, AdresseFilterOptions, AdresseFilters, AdresseSummary } from '../models/adresse.models';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface AdresseState {
  summary: AdresseSummary | null;
  summaryStatus: LoadStatus;
  items: AddressListItem[];
  total: number;
  page: number;
  pageSize: number;
  listStatus: LoadStatus;
  filters: AdresseFilters;
  filterOptions: AdresseFilterOptions;
  selectedIds: string[];
  detailOpenId: string | null;
  detail: AddressDetail | null;
  detailStatus: LoadStatus;
  isMutating: boolean;
}
export const initialAdresseFilters: AdresseFilters = {
  search: '', postcode: null, zone: null, region: null,
  status: null as AddressWorkflowStage | null, team: null,
  cityId: null, communeId: null, zoneId: null, quartierId: null, blocId: null,
};

export const initialAdresseState: AdresseState = {
  summary: null,
  summaryStatus: 'idle',
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  listStatus: 'idle',
  filters: initialAdresseFilters,
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
