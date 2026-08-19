import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Block, UpdateBlockPayload, UUID } from '../../models/das.models';
import { BlocksFilters } from './blocks.state';

export const BlocksActions = createActionGroup({
  source: 'Blocks',
  events: {
    'Load Blocks': emptyProps(),
    'Load Blocks Success': props<{ items: Block[] }>(),
    'Load Blocks Failure': props<{ errorMessageKey: string }>(),
    'Set Filters': props<{ filters: Partial<BlocksFilters> }>(),

    'Load Block Detail': props<{ id: UUID }>(),
    'Load Block Detail Success': props<{ block: Block }>(),
    'Load Block Detail Failure': props<{ errorMessageKey: string }>(),
    'Clear Block Detail': emptyProps(),

    'Update Block': props<{ id: UUID; payload: UpdateBlockPayload }>(),
    'Update Block Success': props<{ block: Block }>(),
    'Update Block Failure': props<{ errorMessageKey: string }>(),
  },
});
