import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Block, UUID } from '../../models/das.models';
import { BlockListItem, BlockWithParcels } from '../models/blocks.models';
import { BlocksFilters } from './blocks.state';

export const BlocksActions = createActionGroup({
  source: 'Blocks',
  events: {
    'Load Blocks': emptyProps(),
    'Load Blocks Success': props<{ items: BlockListItem[] }>(),
    'Load Blocks Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<BlocksFilters> }>(),

    'Load Block Detail': props<{ id: UUID }>(),
    'Load Block Detail Success': props<{ block: BlockWithParcels }>(),
    'Load Block Detail Failure': props<{ errorMessageKey: string }>(),
    'Clear Block Detail': emptyProps(),

    'Assign Block': props<{ id: UUID; userId: UUID }>(),
    'Assign Block Success': props<{ block: Block }>(),
    'Assign Block Failure': props<{ errorMessageKey: string }>(),

    'Set Block Name': props<{ id: UUID; name: string }>(),
    'Set Block Name Success': props<{ block: Block }>(),
    'Set Block Name Failure': props<{ errorMessageKey: string }>(),
  },
});
