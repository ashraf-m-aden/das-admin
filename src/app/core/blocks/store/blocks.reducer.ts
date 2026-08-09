import { createFeature, createReducer, on } from '@ngrx/store';
import { BlocksActions } from './blocks.actions';
import { initialBlocksState } from './blocks.state';

export const blocksFeature = createFeature({
  name: 'blocks',
  reducer: createReducer(
    initialBlocksState,

    on(BlocksActions.loadBlocks, (state) => ({ ...state, listStatus: 'loading' as const, listErrorMessageKey: null })),
    on(BlocksActions.loadBlocksSuccess, (state, { items }) => ({ ...state, items, listStatus: 'loaded' as const })),
    on(BlocksActions.loadBlocksFailure, (state, { errorMessageKey }) => ({
      ...state, listStatus: 'error' as const, listErrorMessageKey: errorMessageKey,
    })),

    on(BlocksActions.setFilters, (state, { filters }) => ({ ...state, filters: { ...state.filters, ...filters } })),

    on(BlocksActions.loadBlockDetail, (state) => ({ ...state, detailStatus: 'loading' as const, detailErrorMessageKey: null })),
    on(BlocksActions.loadBlockDetailSuccess, (state, { block }) => ({ ...state, selected: block, detailStatus: 'loaded' as const })),
    on(BlocksActions.loadBlockDetailFailure, (state, { errorMessageKey }) => ({
      ...state, detailStatus: 'error' as const, detailErrorMessageKey: errorMessageKey,
    })),
    on(BlocksActions.clearBlockDetail, (state) => ({ ...state, selected: null, detailStatus: 'idle' as const })),

    on(BlocksActions.assignBlock, (state) => ({ ...state, isAssigning: true })),
    on(BlocksActions.assignBlockSuccess, (state, { block }) => ({
      ...state,
      isAssigning: false,
      items: state.items.map((b) => (b.id === block.id ? { ...b, ...block } : b)),
      selected: state.selected && state.selected.id === block.id ? { ...state.selected, ...block } : state.selected,
    })),
    on(BlocksActions.assignBlockFailure, (state) => ({ ...state, isAssigning: false })),

    on(BlocksActions.setBlockName, (state) => ({ ...state, isSavingName: true, nameErrorMessageKey: null })),
    on(BlocksActions.setBlockNameSuccess, (state, { block }) => ({
      ...state,
      isSavingName: false,
      items: state.items.map((b) => (b.id === block.id ? { ...b, ...block } : b)),
      selected: state.selected && state.selected.id === block.id ? { ...state.selected, ...block } : state.selected,
    })),
    on(BlocksActions.setBlockNameFailure, (state, { errorMessageKey }) => ({
      ...state, isSavingName: false, nameErrorMessageKey: errorMessageKey,
    })),
  ),
});

export const {
  name: blocksFeatureKey,
  reducer: blocksReducer,
  selectItems, selectListStatus, selectListErrorMessageKey, selectFilters,
  selectSelected, selectDetailStatus, selectDetailErrorMessageKey,
  selectIsAssigning, selectIsSavingName, selectNameErrorMessageKey,
} = blocksFeature;
