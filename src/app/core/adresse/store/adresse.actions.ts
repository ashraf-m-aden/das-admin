import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, AddressListItem, BulkUpdatePayload,
  AdresseFilterOptions, AdresseFilters, AdresseSummary,
} from '../models/adresse.models';

export const AdresseActions = createActionGroup({
  source: 'Adresse',
  events: {
    'Load Summary': emptyProps(),
    'Load Summary Success': props<{ summary: AdresseSummary }>(),
    'Load Summary Failure': props<{ errorMessageKey: string }>(),

    'Load Filter Options Success': props<{ options: AdresseFilterOptions }>(),

    'Load Page': emptyProps(),
    'Load Page Success': props<{ items: AddressListItem[]; total: number; page: number; pageSize: number }>(),
    'Load Page Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<AdresseFilters> }>(),
    'Set Page': props<{ page: number }>(),
    'Set Page Size': props<{ pageSize: number }>(),

    'Toggle Select': props<{ id: UUID }>(),
    'Toggle Select All': props<{ ids: UUID[] }>(),
    'Clear Selection': emptyProps(),

    'Open Detail': props<{ id: UUID }>(),
    'Load Detail Success': props<{ detail: AddressDetail }>(),
    'Load Detail Failure': props<{ errorMessageKey: string }>(),
    'Close Detail': emptyProps(),

    'Approve Selected': emptyProps(),
    'Bulk Update': props<{ payload: BulkUpdatePayload }>(),
    'Mutation Success': emptyProps(),
    'Mutation Failure': props<{ errorMessageKey: string }>(),
  },
});
