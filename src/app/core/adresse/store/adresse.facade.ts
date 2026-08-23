import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AdresseActions } from './adresse.actions';
import { adresseFeature } from './adresse.reducer';
import { selectIsDetailLoading, selectIsListLoading, selectPageInfo, selectSelectedCount } from './adresse.selectors';
import { UUID } from '../../models/das.models';
import { BulkUpdatePayload, AdresseFilters, UpdateAdressePayload } from '../models/adresse.models';

@Injectable({ providedIn: 'root' })
export class AdresseFacade {
  private store = inject(Store);

  summary$ = this.store.select(adresseFeature.selectSummary);
  items$ = this.store.select(adresseFeature.selectItems);
  filters$ = this.store.select(adresseFeature.selectFilters);
  filterOptions$ = this.store.select(adresseFeature.selectFilterOptions);
  isListLoading$ = this.store.select(selectIsListLoading);
  pageInfo$ = this.store.select(selectPageInfo);

  selectedIds$ = this.store.select(adresseFeature.selectSelectedIds);
  selectedCount$ = this.store.select(selectSelectedCount);

  detailOpenId$ = this.store.select(adresseFeature.selectDetailOpenId);
  detail$ = this.store.select(adresseFeature.selectDetail);
  isDetailLoading$ = this.store.select(selectIsDetailLoading);
  isMutating$ = this.store.select(adresseFeature.selectIsMutating);
  updateErrorMessageKey$ = this.store.select(adresseFeature.selectUpdateErrorMessageKey);

  init(): void {
    this.store.dispatch(AdresseActions.loadSummary());
    this.store.dispatch(AdresseActions.loadPage());
  }
  setFilters(filters: Partial<AdresseFilters>): void { this.store.dispatch(AdresseActions.setFilters({ filters })); }
  setPage(page: number): void { this.store.dispatch(AdresseActions.setPage({ page })); }
  setPageSize(pageSize: number): void { this.store.dispatch(AdresseActions.setPageSize({ pageSize })); }

  toggleSelect(id: UUID): void { this.store.dispatch(AdresseActions.toggleSelect({ id })); }
  toggleSelectAll(ids: UUID[]): void { this.store.dispatch(AdresseActions.toggleSelectAll({ ids })); }
  clearSelection(): void { this.store.dispatch(AdresseActions.clearSelection()); }

  openDetail(id: UUID): void { this.store.dispatch(AdresseActions.openDetail({ id })); }
  closeDetail(): void { this.store.dispatch(AdresseActions.closeDetail()); }

  approveSelected(): void { this.store.dispatch(AdresseActions.approveSelected()); }
  bulkUpdate(payload: BulkUpdatePayload): void { this.store.dispatch(AdresseActions.bulkUpdate({ payload })); }
  updateAdresse(id: UUID, payload: UpdateAdressePayload): void { this.store.dispatch(AdresseActions.updateAdresse({ id, payload })); }
}
