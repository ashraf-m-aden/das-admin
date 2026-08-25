import { createSelector } from '@ngrx/store';
import { discoveriesFeature } from './discoveries.reducer';
import { DiscoveryQuery } from '../models/discoveries.models';

export const selectIsListLoading = createSelector(
  discoveriesFeature.selectListStatus,
  (s) => s === 'loading',
);

/**
 * Compteurs par statut, calculés **sur la liste chargée**. Ils ne valent donc que dans le
 * périmètre du filtre courant — et comme le filtre par défaut est `Pending`, deux des trois
 * seront à 0 tant que l'opérateur n'a pas élargi. C'est voulu : afficher des totaux globaux
 * demanderait un appel de plus par statut, pour une information que l'écran de tri n'utilise pas.
 */
export const selectCounts = createSelector(
  discoveriesFeature.selectReports,
  (reports) => ({
    pending: reports.filter((r) => r.status === 'Pending').length,
    accepted: reports.filter((r) => r.status === 'Accepted').length,
    rejected: reports.filter((r) => r.status === 'Rejected').length,
  }),
);

export const selectSelectedReport = createSelector(
  discoveriesFeature.selectReports,
  discoveriesFeature.selectSelectedId,
  (reports, id) => reports.find((r) => r.id === id) ?? null,
);

/** Les deux filtres forment la query envoyée au back. Un seul sélecteur, deux consommateurs : la liste et l'export. */
export const selectQuery = createSelector(
  discoveriesFeature.selectCampaignId,
  discoveriesFeature.selectStatus,
  (campaignId, status): DiscoveryQuery => ({ campaignId, status }),
);
