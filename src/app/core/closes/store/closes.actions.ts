import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Block, UUID } from '../../models/das.models';
import { Close, CloseNumberingPlan, CloseStreetOption, CreateClosePayload } from '../models/closes.models';

export const ClosesActions = createActionGroup({
  source: 'Closes',
  events: {
    /** Sélection d'un quartier dans la cascade — déclenche le chargement des closes ET de ses blocs. */
    'Select Quartier': props<{ quartierId: UUID | null }>(),

    'Load List': emptyProps(),
    'Load List Success': props<{ closes: Close[] }>(),
    'Load List Failure': props<{ errorMessageKey: string }>(),

    'Load Streets': emptyProps(),
    'Load Streets Success': props<{ streets: CloseStreetOption[] }>(),

    'Load Blocs': emptyProps(),
    'Load Blocs Success': props<{ blocs: Block[] }>(),

    /** `payload` porte toujours `quartierId` (contexte de l'écran) ; l'effet le retire pour `update` (non modifiable, §3.2). */
    'Save Close': props<{ id: UUID | null; payload: CreateClosePayload }>(),
    'Save Close Success': emptyProps(),
    'Save Close Failure': props<{ errorMessageKey: string }>(),

    'Remove Close': props<{ id: UUID }>(),
    'Remove Close Success': emptyProps(),
    'Remove Close Failure': props<{ errorMessageKey: string }>(),

    /** Demande l'aperçu — n'écrit rien côté back. */
    'Preview Numbering': props<{ closeId: UUID; blocIds: UUID[]; reverse: boolean }>(),
    'Preview Numbering Success': props<{ plan: CloseNumberingPlan; blocIds: UUID[] }>(),
    'Preview Numbering Failure': props<{ errorMessageKey: string }>(),
    /** Correction manuelle d'un numéro proposé, avant application. */
    'Edit Planned Numero': props<{ adresseId: UUID; numero: number }>(),
    'Discard Plan': emptyProps(),

    'Attach Blocs': props<{ closeId: UUID; blocIds: UUID[] }>(),
    'Attach Blocs Success': emptyProps(),
    'Attach Blocs Failure': props<{ errorMessageKey: string }>(),

    'Detach Bloc': props<{ closeId: UUID; blocId: UUID }>(),
    'Detach Bloc Success': emptyProps(),
    'Detach Bloc Failure': props<{ errorMessageKey: string }>(),
  },
});
