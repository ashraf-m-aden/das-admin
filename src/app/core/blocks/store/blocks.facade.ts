import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { BlocksActions } from './blocks.actions';
import { blocksFeature } from './blocks.reducer';
import { selectBlocksAsGeoJson, selectIsBlockDetailLoading, selectIsBlocksListLoading } from './blocks.selectors';
import { BlockStatus, UUID } from '../../models/das.models';
import { BlocksFilters } from './blocks.state';

@Injectable({ providedIn: 'root' })
export class BlocksFacade {
  private store = inject(Store);

  items$ = this.store.select(blocksFeature.selectItems);
  filters$ = this.store.select(blocksFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsBlocksListLoading);
  listErrorMessageKey$ = this.store.select(blocksFeature.selectListErrorMessageKey);

  blocksGeoJson$ = this.store.select(selectBlocksAsGeoJson);
isSavingStatus$ = this.store.select(blocksFeature.selectIsSavingStatus);
  setStatus(id: UUID, status: BlockStatus): void { this.store.dispatch(BlocksActions.setBlockStatus({ id, status })); }
  selected$ = this.store.select(blocksFeature.selectSelected);
  isDetailLoading$ = this.store.select(selectIsBlockDetailLoading);
  detailErrorMessageKey$ = this.store.select(blocksFeature.selectDetailErrorMessageKey);
  isAssigning$ = this.store.select(blocksFeature.selectIsAssigning);

  isSavingName$ = this.store.select(blocksFeature.selectIsSavingName);
  nameErrorMessageKey$ = this.store.select(blocksFeature.selectNameErrorMessageKey);

  load(): void { this.store.dispatch(BlocksActions.loadBlocks()); }
  setFilters(filters: Partial<BlocksFilters>): void { this.store.dispatch(BlocksActions.setFilters({ filters })); }
  loadDetail(id: UUID): void { this.store.dispatch(BlocksActions.loadBlockDetail({ id })); }
  clearDetail(): void { this.store.dispatch(BlocksActions.clearBlockDetail()); }
  assign(id: UUID, userId: UUID): void { this.store.dispatch(BlocksActions.assignBlock({ id, userId })); }
  setName(id: UUID, name: string): void { this.store.dispatch(BlocksActions.setBlockName({ id, name })); }
}
