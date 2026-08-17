import { BlockListItem, BlockListQuery, BlockWithParcels } from '../models/blocks.models';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';

export type BlocksListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type BlockDetailStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** Filtres du module = requête de listing (search + status + sélection hiérarchie). */
export type BlocksFilters = BlockListQuery;

export interface BlocksState {
  items: BlockListItem[];
  listStatus: BlocksListStatus;
  listErrorMessageKey: string | null;
  filters: BlocksFilters;
  isSavingStatus: boolean;
  statusErrorMessageKey: string | null;
  selected: BlockWithParcels | null;
  detailStatus: BlockDetailStatus;
  detailErrorMessageKey: string | null;

  isAssigning: boolean;

  isSavingName: boolean;
  nameErrorMessageKey: string | null;
}

export const initialBlocksState: BlocksState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { search: '', status: null, ...EMPTY_HIERARCHY_SELECTION },
  isSavingStatus: false,
  statusErrorMessageKey: null,
  selected: null,
  detailStatus: 'idle',
  detailErrorMessageKey: null,

  isAssigning: false,

  isSavingName: false,
  nameErrorMessageKey: null,
};
