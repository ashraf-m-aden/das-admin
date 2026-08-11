import { createFeature, createReducer, on } from '@ngrx/store';
import { RegistryActions } from './registry.actions';
import { initialRegistryState } from './registry.state';

export const registryFeature = createFeature({
  name: 'registry',
  reducer: createReducer(
    initialRegistryState,

    on(RegistryActions.loadSummary, (s) => ({ ...s, summaryStatus: 'loading' as const })),
    on(RegistryActions.loadSummarySuccess, (s, { summary }) => ({ ...s, summary, summaryStatus: 'loaded' as const })),
    on(RegistryActions.loadSummaryFailure, (s) => ({ ...s, summaryStatus: 'error' as const })),

    on(RegistryActions.loadFilterOptionsSuccess, (s, { options }) => ({ ...s, filterOptions: options })),

    on(RegistryActions.loadPage, (s) => ({ ...s, listStatus: 'loading' as const })),
    on(RegistryActions.loadPageSuccess, (s, { items, total, page, pageSize }) => ({
      ...s, items, total, page, pageSize, listStatus: 'loaded' as const,
    })),
    on(RegistryActions.loadPageFailure, (s) => ({ ...s, listStatus: 'error' as const })),

    on(RegistryActions.setFilters, (s, { filters }) => ({ ...s, filters: { ...s.filters, ...filters }, page: 1, selectedIds: [] })),
    on(RegistryActions.setPage, (s, { page }) => ({ ...s, page })),
    on(RegistryActions.setPageSize, (s, { pageSize }) => ({ ...s, pageSize, page: 1 })),

    on(RegistryActions.toggleSelect, (s, { id }) => ({
      ...s,
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
    on(RegistryActions.toggleSelectAll, (s, { ids }) => ({
      ...s,
      selectedIds: ids.every((id) => s.selectedIds.includes(id)) ? [] : [...ids],
    })),
    on(RegistryActions.clearSelection, (s) => ({ ...s, selectedIds: [] })),

    on(RegistryActions.openDetail, (s, { id }) => ({ ...s, detailOpenId: id, detail: null, detailStatus: 'loading' as const })),
    on(RegistryActions.loadDetailSuccess, (s, { detail }) => ({ ...s, detail, detailStatus: 'loaded' as const })),
    on(RegistryActions.loadDetailFailure, (s) => ({ ...s, detailStatus: 'error' as const })),
    on(RegistryActions.closeDetail, (s) => ({ ...s, detailOpenId: null, detail: null, detailStatus: 'idle' as const })),

    on(RegistryActions.approveSelected, RegistryActions.changeTeam, RegistryActions.bulkUpdate, RegistryActions.flagForReview,
      (s) => ({ ...s, isMutating: true })),
    on(RegistryActions.mutationSuccess, (s) => ({ ...s, isMutating: false, selectedIds: [] })),
    on(RegistryActions.mutationFailure, (s) => ({ ...s, isMutating: false })),
  ),
});

export const {
  name: registryFeatureKey,
  reducer: registryReducer,
  selectSummary, selectSummaryStatus,
  selectItems, selectTotal, selectPage, selectPageSize, selectListStatus,
  selectFilters, selectFilterOptions, selectSelectedIds,
  selectDetailOpenId, selectDetail, selectDetailStatus, selectIsMutating,
} = registryFeature;
