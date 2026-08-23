import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Block, UUID } from '../../models/das.models';
import { Close, SaveClosePayload } from '../models/closes.models';

export const ClosesActions = createActionGroup({
  source: 'Closes',
  events: {
    /** Sélection d'un quartier dans la cascade — déclenche le chargement des closes ET de ses blocs. */
    'Select Quartier': props<{ quartierId: UUID | null }>(),

    'Load List': emptyProps(),
    'Load List Success': props<{ closes: Close[] }>(),
    'Load List Failure': props<{ errorMessageKey: string }>(),

    'Load Blocs Success': props<{ blocs: Block[] }>(),

    'Save Close': props<{ id: UUID | null; payload: SaveClosePayload }>(),
    'Save Close Success': emptyProps(),
    'Save Close Failure': props<{ errorMessageKey: string }>(),

    'Remove Close': props<{ id: UUID }>(),
    'Remove Close Success': emptyProps(),
    'Remove Close Failure': props<{ errorMessageKey: string }>(),
  },
});
