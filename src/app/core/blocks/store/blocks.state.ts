import { BlockStatus, UUID } from '../../models/das.models';
import { BlockListItem, BlockWithLots } from '../models/blocks.models';

export type BlocksListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type BlockDetailStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface BlocksFilters {
  search: string;
  status: BlockStatus | null;
  adminUnitId: UUID | null;
}

export interface BlocksState {
  items: BlockListItem[];
  listStatus: BlocksListStatus;
  listErrorMessageKey: string | null;
  filters: BlocksFilters;

  selected: BlockWithLots | null;
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
  filters: { search: '', status: null, adminUnitId: null },

  selected: null,
  detailStatus: 'idle',
  detailErrorMessageKey: null,

  isAssigning: false,

  isSavingName: false,
  nameErrorMessageKey: null,
};
