import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import {
  BlockNamingQuery,
  BlockToName,
  PropertyNumberingQuery,
  PropertyToNumber,
  StreetNamingQuery,
  StreetToName,
} from '../models/addressing.models';

export const AddressingActions = createActionGroup({
  source: 'Addressing',
  events: {
    'Load Blocks To Name': emptyProps(),
    'Load Blocks To Name Success': props<{ items: BlockToName[] }>(),
    'Load Blocks To Name Failure': props<{ errorMessageKey: string }>(),
    'Set Block Filters': props<{ filters: Partial<BlockNamingQuery> }>(),

    'Set Block Name': props<{ id: UUID; name: string }>(),
    'Approve Block Suggestion': props<{ id: UUID; suggestionId: UUID }>(),
    'Reject Block Suggestion': props<{ id: UUID; suggestionId: UUID; rejectionReason: string }>(),
    'Block Name Action Success': props<{ item: BlockToName }>(),
    'Block Suggestion Decided': emptyProps(),
    'Block Name Action Failure': props<{ errorMessageKey: string }>(),

    'Load Streets To Name': emptyProps(),
    'Load Streets To Name Success': props<{ items: StreetToName[] }>(),
    'Load Streets To Name Failure': props<{ errorMessageKey: string }>(),
    'Set Street Filters': props<{ filters: Partial<StreetNamingQuery> }>(),

    'Set Street Name': props<{ id: UUID; name: string }>(),
    'Approve Street Suggestion': props<{ id: UUID; suggestionId: UUID }>(),
    'Reject Street Suggestion': props<{ id: UUID; suggestionId: UUID; rejectionReason: string }>(),
    'Street Name Action Success': props<{ item: StreetToName }>(),
    'Street Suggestion Decided': emptyProps(),
    'Street Name Action Failure': props<{ errorMessageKey: string }>(),

    'Load Properties To Number': props<{ query: PropertyNumberingQuery }>(),
    'Load Properties To Number Success': props<{ items: PropertyToNumber[] }>(),
    'Load Properties To Number Failure': props<{ errorMessageKey: string }>(),
'Assign House Number': props<{ id: UUID; payload: { numero: string } }>(),    'Assign House Number Success': props<{ item: PropertyToNumber }>(),
    'Assign House Number Failure': props<{ errorMessageKey: string }>(),

  },
});
