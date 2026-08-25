import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { UUID } from '../../models/das.models';
import { DiscoveryFeatureCollection, DiscoveryReport, DiscoveryStatus } from '../models/discoveries.models';

export const DiscoveriesActions = createActionGroup({
  source: 'Discoveries',
  events: {
    /** Filtres de l'écran. `null` = tous. Les deux déclenchent un rechargement via l'effet. */
    'Set Campaign Filter': props<{ campaignId: UUID | null }>(),
    'Set Status Filter': props<{ status: DiscoveryStatus | null }>(),

    /** Les filtres sont relus dans le store par l'effet (`concatLatestFrom`), pas portés ici — CLAUDE.md §4. */
    'Load List': emptyProps(),
    'Load List Success': props<{ reports: DiscoveryReport[] }>(),
    'Load List Failure': props<{ errorMessageKey: string }>(),

    /** Référentiel des campagnes, pour le sélecteur de filtre. Chargé une fois à l'entrée. */
    'Load Campaigns Success': props<{ campaigns: { id: UUID; label: string }[] }>(),

    'Select Report': props<{ id: UUID | null }>(),

    'Accept': props<{ id: UUID }>(),
    'Reject': props<{ id: UUID; rejectionReason: string }>(),
    /** Une seule paire succès/échec pour les deux décisions : l'écran les traite pareil (recharger + refermer). */
    'Review Success': props<{ report: DiscoveryReport }>(),
    'Review Failure': props<{ errorMessageKey: string }>(),

    'Export': emptyProps(),
    'Export Success': props<{ collection: DiscoveryFeatureCollection }>(),
    'Export Failure': props<{ errorMessageKey: string }>(),
  },
});
