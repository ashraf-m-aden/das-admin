import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import {
  ApiTokenItem,
  ClientListItem,
  CreateApiTokenPayload,
  CreateClientPayload,
  GrantZoneAccessPayload,
  SubscriptionPlanOption,
  UpdateClientPayload,
  ZoneAccessItem,
  ZoneOption,
} from '../models/clients.models';
import { ClientFilters } from './clients.state';

export const ClientsActions = createActionGroup({
  source: 'Clients',
  events: {
    'Load List': emptyProps(),
    'Load List Success': props<{ items: ClientListItem[] }>(),
    'Load List Failure': props<{ errorMessageKey: string }>(),
    'Set Filters': props<{ filters: Partial<ClientFilters> }>(),

    'Load Plans': emptyProps(),
    'Load Plans Success': props<{ items: SubscriptionPlanOption[] }>(),

    'Create Client': props<{ payload: CreateClientPayload }>(),
    'Create Client Success': props<{ client: ClientListItem; temporaryPassword: string }>(),
    'Create Client Failure': props<{ errorMessageKey: string }>(),

    'Update Client': props<{ id: UUID; payload: UpdateClientPayload }>(),
    'Update Client Success': props<{ client: ClientListItem }>(),
    'Update Client Failure': props<{ errorMessageKey: string }>(),

    'Set Enabled': props<{ id: UUID; enabled: boolean }>(),
    'Set Enabled Success': props<{ client: ClientListItem }>(),
    'Set Enabled Failure': props<{ errorMessageKey: string }>(),

    'Clear Temporary Password': emptyProps(),

    'Load Zone Access': props<{ clientId: UUID }>(),
    'Load Zone Access Success': props<{ items: ZoneAccessItem[] }>(),
    'Load Zone Access Failure': props<{ errorMessageKey: string }>(),
    'Load Available Zones': emptyProps(),
    'Load Available Zones Success': props<{ items: ZoneOption[] }>(),

    'Grant Zone Access': props<{ clientId: UUID; payload: GrantZoneAccessPayload }>(),
    'Grant Zone Access Success': props<{ item: ZoneAccessItem }>(),
    'Grant Zone Access Failure': props<{ errorMessageKey: string }>(),

    'Revoke Zone Access': props<{ clientId: UUID; zoneAccessId: UUID }>(),
    'Revoke Zone Access Success': props<{ item: ZoneAccessItem }>(),
    'Revoke Zone Access Failure': props<{ errorMessageKey: string }>(),

    'Load Api Token': props<{ clientId: UUID }>(),
    'Load Api Token Success': props<{ item: ApiTokenItem | null }>(),
    'Load Api Token Failure': props<{ errorMessageKey: string }>(),

    'Regenerate Api Token': props<{ clientId: UUID; payload: CreateApiTokenPayload }>(),
    'Regenerate Api Token Success': props<{ token: ApiTokenItem; rawToken: string }>(),
    'Regenerate Api Token Failure': props<{ errorMessageKey: string }>(),
    'Clear Last Created Token': emptyProps(),

    'Revoke Api Token': props<{ clientId: UUID }>(),
    'Revoke Api Token Success': emptyProps(),
    'Revoke Api Token Failure': props<{ errorMessageKey: string }>(),
  },
});
