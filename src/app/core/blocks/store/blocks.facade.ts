import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { BlocksActions } from './blocks.actions';
import { blocksFeature } from './blocks.reducer';
import { selectIsBlockDetailLoading, selectIsBlocksListLoading } from './blocks.selectors';
import { UpdateBlockPayload, UUID } from '../../models/das.models';
import { BlocksFilters } from './blocks.state';

@Injectable({ providedIn: 'root' })
export class BlocksFacade {
  private store = inject(Store);

  items$ = this.store.select(blocksFeature.selectItems);
  filters$ = this.store.select(blocksFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsBlocksListLoading);
  listErrorMessageKey$ = this.store.select(blocksFeature.selectListErrorMessageKey);

  selected$ = this.store.select(blocksFeature.selectSelected);
  isDetailLoading$ = this.store.select(selectIsBlockDetailLoading);
  detailErrorMessageKey$ = this.store.select(blocksFeature.selectDetailErrorMessageKey);

  isUpdating$ = this.store.select(blocksFeature.selectIsUpdating);
  updateErrorMessageKey$ = this.store.select(blocksFeature.selectUpdateErrorMessageKey);

  load(): void { this.store.dispatch(BlocksActions.loadBlocks()); }
  setFilters(filters: Partial<BlocksFilters>): void { this.store.dispatch(BlocksActions.setFilters({ filters })); }
  loadDetail(id: UUID): void { this.store.dispatch(BlocksActions.loadBlockDetail({ id })); }
  clearDetail(): void { this.store.dispatch(BlocksActions.clearBlockDetail()); }
  update(id: UUID, payload: UpdateBlockPayload): void { this.store.dispatch(BlocksActions.updateBlock({ id, payload })); }
}
