import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import {
  CloseNumberingPlan, CloseStreetOption, QuartierClosePlan, QuartierClosePlanParameters,
  QuartierCloseProgress,
} from '../models/closes.models';

export const CloseGenerationActions = createActionGroup({
  source: 'Close Generation',
  events: {
    'Load Progress': emptyProps(),
    'Load Progress Success': props<{ progress: QuartierCloseProgress[] }>(),
    'Load Progress Failure': props<{ errorMessageKey: string }>(),

    'Load Streets': emptyProps(),
    'Load Streets Success': props<{ streets: CloseStreetOption[] }>(),

    /** Choix d'un quartier dans la liste. Vide l'aperçu précédent et en demande un nouveau. */
    'Select Quartier': props<{ quartierId: UUID | null }>(),

    /** Réglages de l'appariement. Relance l'aperçu — les corrections en cours sont perdues. */
    'Set Parameters': props<{ parameters: Partial<QuartierClosePlanParameters> }>(),

    /** N'écrit rien. */
    'Preview': emptyProps(),
    'Preview Success': props<{ plan: QuartierClosePlan }>(),
    'Preview Failure': props<{ errorMessageKey: string }>(),

    /* -- relecture ------------------------------------------------------------------------ */

    'Change Street': props<{ key: string; streetId: UUID }>(),
    'Change Number': props<{ key: string; number: number }>(),
    'Change Code': props<{ key: string; code: string }>(),
    /** Retire un bloc d'une proposition. Il ne rejoint aucune autre : il sort du plan. */
    'Remove Bloc': props<{ key: string; blocId: UUID }>(),
    /** Déplace un bloc d'une proposition vers une autre, en une action pour rester atomique. */
    'Move Bloc': props<{ fromKey: string; toKey: string; blocId: UUID }>(),
    'Discard Proposal': props<{ key: string }>(),
    'Restore Proposal': props<{ key: string }>(),

    /** Nomme une rue sans quitter l'écran — 941 rues sur 1 344 n'ont pas de nom. */
    'Rename Street': props<{ street: CloseStreetOption; name: string }>(),
    'Rename Street Success': props<{ street: CloseStreetOption }>(),
    'Rename Street Failure': props<{ errorMessageKey: string }>(),

    /* -- plan de numérotation ------------------------------------------------------------- */

    /** Ouvre le plan d'une proposition. N'écrit rien. */
    'Open Numbering': props<{ key: string; reverse: boolean }>(),
    'Open Numbering Success': props<{ key: string; numbering: CloseNumberingPlan }>(),
    'Open Numbering Failure': props<{ errorMessageKey: string }>(),
    'Edit Planned Numero': props<{ adresseId: UUID; numero: number }>(),
    'Close Numbering': emptyProps(),
    /** Marque la proposition comme relue — condition de la confirmation. */
    'Mark Reviewed': props<{ key: string }>(),

    /* -- confirmation ---------------------------------------------------------------------- */

    /**
     * Écrit le plan RELU : closes, rattachement des blocs et renumérotation, dans une seule
     * transaction côté back. C'est la seule action de cet écran qui écrit quoi que ce soit.
     *
     * On envoie les closes TELLES QU'ELLES SONT à l'écran, corrections comprises — jamais une clé
     * de proposition que le serveur recalculerait : entre l'aperçu et la confirmation, une rue a
     * pu changer et des blocs bouger.
     */
    'Apply': emptyProps(),
    'Apply Success': props<{ closesCreated: number; blocsAttached: number; adressesRenumbered: number }>(),
    'Apply Failure': props<{ errorMessageKey: string }>(),

    'Clear Error': emptyProps(),
  },
});
