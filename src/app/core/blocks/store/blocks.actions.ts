import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Block, UUID } from '../../models/das.models';
import { BlockWithLots } from '../models/blocks.models';
import { BlocksFilters } from './blocks.state';

export const BlocksActions = createActionGroup({
  source: 'Blocks',
  events: {
    'Load Blocks': emptyProps(),
    'Load Blocks Success': props<{ items: Block[] }>(),
    'Load Blocks Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<BlocksFilters> }>(),

    'Load Block Detail': props<{ id: UUID }>(),
    'Load Block Detail Success': props<{ block: BlockWithLots }>(),
    'Load Block Detail Failure': props<{ errorMessageKey: string }>(),
    'Clear Block Detail': emptyProps(),

    'Assign Block': props<{ id: UUID; userId: UUID }>(),
    'Assign Block Success': props<{ block: Block }>(),
    'Assign Block Failure': props<{ errorMessageKey: string }>(),
  },
});
