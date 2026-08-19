import { createFeature, createReducer, on } from '@ngrx/store';
import { AdresseActions } from './adresse.actions';
import { initialAdresseState } from './adresse.state';

export const adresseFeature = createFeature({
  name: 'adresse',
  reducer: createReducer(
    initialAdresseState,

    on(AdresseActions.loadSummary, (s) => ({ ...s, summaryStatus: 'loading' as const })),
    on(AdresseActions.loadSummarySuccess, (s, { summary }) => ({ ...s, summary, summaryStatus: 'loaded' as const })),
    on(AdresseActions.loadSummaryFailure, (s) => ({ ...s, summaryStatus: 'error' as const })),

    on(AdresseActions.loadFilterOptionsSuccess, (s, { options }) => ({ ...s, filterOptions: options })),

    on(AdresseActions.loadPage, (s) => ({ ...s, listStatus: 'loading' as const })),
    on(AdresseActions.loadPageSuccess, (s, { items, total, page, pageSize }) => ({
      ...s, items, total, page, pageSize, listStatus: 'loaded' as const,
    })),
    on(AdresseActions.loadPageFailure, (s) => ({ ...s, listStatus: 'error' as const })),

    on(AdresseActions.setFilters, (s, { filters }) => ({ ...s, filters: { ...s.filters, ...filters }, page: 1, selectedIds: [] })),
    on(AdresseActions.setPage, (s, { page }) => ({ ...s, page })),
    on(AdresseActions.setPageSize, (s, { pageSize }) => ({ ...s, pageSize, page: 1 })),

    on(AdresseActions.toggleSelect, (s, { id }) => ({
      ...s,
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
    on(AdresseActions.toggleSelectAll, (s, { ids }) => ({
      ...s,
      selectedIds: ids.every((id) => s.selectedIds.includes(id)) ? [] : [...ids],
    })),
    on(AdresseActions.clearSelection, (s) => ({ ...s, selectedIds: [] })),

    on(AdresseActions.openDetail, (s, { id }) => ({ ...s, detailOpenId: id, detail: null, detailStatus: 'loading' as const })),
    on(AdresseActions.loadDetailSuccess, (s, { detail }) => ({ ...s, detail, detailStatus: 'loaded' as const })),
    on(AdresseActions.loadDetailFailure, (s) => ({ ...s, detailStatus: 'error' as const })),
    on(AdresseActions.closeDetail, (s) => ({ ...s, detailOpenId: null, detail: null, detailStatus: 'idle' as const })),

    on(AdresseActions.approveSelected, AdresseActions.bulkUpdate,
      (s) => ({ ...s, isMutating: true })),
    on(AdresseActions.mutationSuccess, (s) => ({ ...s, isMutating: false, selectedIds: [] })),
    on(AdresseActions.mutationFailure, (s) => ({ ...s, isMutating: false })),
  ),
});

export const {
  name: adresseFeatureKey,
  reducer: adresseReducer,
  selectSummary, selectSummaryStatus,
  selectItems, selectTotal, selectPage, selectPageSize, selectListStatus,
  selectFilters, selectFilterOptions, selectSelectedIds,
  selectDetailOpenId, selectDetail, selectDetailStatus, selectIsMutating,
} = adresseFeature;
