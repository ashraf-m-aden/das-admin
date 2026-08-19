import { Block } from '../../models/das.models';
import { BlockListQuery } from '../models/blocks.models';
import { EMPTY_HIERARCHY_SELECTION } from '../../hierarchy/models/hierarchy.models';

export type BlocksListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type BlockDetailStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type BlocksFilters = BlockListQuery;

export interface BlocksState {
  items: Block[];
  listStatus: BlocksListStatus;
  listErrorMessageKey: string | null;
  filters: BlocksFilters;

  selected: Block | null;
  detailStatus: BlockDetailStatus;
  detailErrorMessageKey: string | null;

  isUpdating: boolean;
  updateErrorMessageKey: string | null;
}

export const initialBlocksState: BlocksState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { ...EMPTY_HIERARCHY_SELECTION },

  selected: null,
  detailStatus: 'idle',
  detailErrorMessageKey: null,

  isUpdating: false,
  updateErrorMessageKey: null,
};
