import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, AddressListItem, BulkUpdatePayload,
  RegistryFilterOptions, RegistryFilters, RegistrySummary,
} from '../models/registry.models';

export const RegistryActions = createActionGroup({
  source: 'Registry',
  events: {
    'Load Summary': emptyProps(),
    'Load Summary Success': props<{ summary: RegistrySummary }>(),
    'Load Summary Failure': props<{ errorMessageKey: string }>(),

    'Load Filter Options Success': props<{ options: RegistryFilterOptions }>(),

    'Load Page': emptyProps(),
    'Load Page Success': props<{ items: AddressListItem[]; total: number; page: number; pageSize: number }>(),
    'Load Page Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<RegistryFilters> }>(),
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
    'Change Team': props<{ team: string }>(),
    'Bulk Update': props<{ payload: BulkUpdatePayload }>(),
    'Flag For Review': props<{ id: UUID }>(),
    'Mutation Success': emptyProps(),
    'Mutation Failure': props<{ errorMessageKey: string }>(),
  },
});
