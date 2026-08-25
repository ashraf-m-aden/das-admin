import { createFeature, createReducer, on } from '@ngrx/store';
import { DiscoveriesActions } from './discoveries.actions';
import { initialDiscoveriesState } from './discoveries.state';

export const discoveriesFeature = createFeature({
  name: 'discoveries',
  reducer: createReducer(
    initialDiscoveriesState,

    // Changer de filtre vide la liste : garder l'ancienne afficherait, le temps du chargement,
    // des signalements qui ne correspondent plus au filtre affiché.
    on(DiscoveriesActions.setCampaignFilter, (s, { campaignId }) => ({
      ...s, campaignId, reports: [], selectedId: null, errorMessageKey: null,
    })),
    on(DiscoveriesActions.setStatusFilter, (s, { status }) => ({
      ...s, status, reports: [], selectedId: null, errorMessageKey: null,
    })),

    on(DiscoveriesActions.loadList, (s) => ({ ...s, listStatus: 'loading' as const })),
    on(DiscoveriesActions.loadListSuccess, (s, { reports }) => ({
      ...s, reports, listStatus: 'loaded' as const,
      // La sélection ne survit pas à un rechargement qui la fait sortir de la liste.
      selectedId: reports.some((r) => r.id === s.selectedId) ? s.selectedId : null,
    })),
    on(DiscoveriesActions.loadListFailure, (s, { errorMessageKey }) => ({
      ...s, listStatus: 'error' as const, errorMessageKey,
    })),

    on(DiscoveriesActions.loadCampaignsSuccess, (s, { campaigns }) => ({ ...s, campaigns })),

    on(DiscoveriesActions.selectReport, (s, { id }) => ({ ...s, selectedId: id })),

    on(DiscoveriesActions.accept, DiscoveriesActions.reject, (s) => ({
      ...s, isReviewing: true, errorMessageKey: null,
    })),
    on(DiscoveriesActions.reviewSuccess, (s) => ({
      ...s, isReviewing: false, reviewTick: s.reviewTick + 1,
    })),
    on(DiscoveriesActions.reviewFailure, (s, { errorMessageKey }) => ({
      ...s, isReviewing: false, errorMessageKey,
    })),

    on(DiscoveriesActions.export, (s) => ({ ...s, isExporting: true, errorMessageKey: null })),
    on(DiscoveriesActions.exportSuccess, (s) => ({ ...s, isExporting: false })),
    on(DiscoveriesActions.exportFailure, (s, { errorMessageKey }) => ({
      ...s, isExporting: false, errorMessageKey,
    })),
  ),
});

export const {
  name: discoveriesFeatureKey,
  reducer: discoveriesReducer,
  selectReports, selectCampaigns, selectCampaignId, selectStatus, selectSelectedId,
  selectListStatus, selectIsReviewing, selectIsExporting, selectErrorMessageKey, selectReviewTick,
} = discoveriesFeature;
