import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { RegistryActions } from './registry.actions';
import { registryFeature } from './registry.reducer';
import { selectIsDetailLoading, selectIsListLoading, selectPageInfo, selectSelectedCount } from './registry.selectors';
import { UUID } from '../../models/das.models';
import { BulkUpdatePayload, RegistryFilters } from '../models/registry.models';

@Injectable({ providedIn: 'root' })
export class RegistryFacade {
  private store = inject(Store);

  summary$ = this.store.select(registryFeature.selectSummary);
  items$ = this.store.select(registryFeature.selectItems);
  filters$ = this.store.select(registryFeature.selectFilters);
  filterOptions$ = this.store.select(registryFeature.selectFilterOptions);
  isListLoading$ = this.store.select(selectIsListLoading);
  pageInfo$ = this.store.select(selectPageInfo);

  selectedIds$ = this.store.select(registryFeature.selectSelectedIds);
  selectedCount$ = this.store.select(selectSelectedCount);

  detailOpenId$ = this.store.select(registryFeature.selectDetailOpenId);
  detail$ = this.store.select(registryFeature.selectDetail);
  isDetailLoading$ = this.store.select(selectIsDetailLoading);
  isMutating$ = this.store.select(registryFeature.selectIsMutating);

  init(): void {
    this.store.dispatch(RegistryActions.loadSummary());
    this.store.dispatch(RegistryActions.loadPage());
  }
  setFilters(filters: Partial<RegistryFilters>): void { this.store.dispatch(RegistryActions.setFilters({ filters })); }
  setPage(page: number): void { this.store.dispatch(RegistryActions.setPage({ page })); }
  setPageSize(pageSize: number): void { this.store.dispatch(RegistryActions.setPageSize({ pageSize })); }

  toggleSelect(id: UUID): void { this.store.dispatch(RegistryActions.toggleSelect({ id })); }
  toggleSelectAll(ids: UUID[]): void { this.store.dispatch(RegistryActions.toggleSelectAll({ ids })); }
  clearSelection(): void { this.store.dispatch(RegistryActions.clearSelection()); }

  openDetail(id: UUID): void { this.store.dispatch(RegistryActions.openDetail({ id })); }
  closeDetail(): void { this.store.dispatch(RegistryActions.closeDetail()); }

  approveSelected(): void { this.store.dispatch(RegistryActions.approveSelected()); }
  bulkUpdate(payload: BulkUpdatePayload): void { this.store.dispatch(RegistryActions.bulkUpdate({ payload })); }
}
