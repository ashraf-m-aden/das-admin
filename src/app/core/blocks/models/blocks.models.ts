import { UUID, Block, BlockStatus, Lot } from '../../models/das.models';

export interface BlockListQuery {
  search: string;
  status: BlockStatus | null;
  adminUnitId: UUID | null;
}

export interface BlockWithLots extends Block {
  lots: Lot[];
}

export interface BlockGeoJsonProperties {
  id: UUID;
  code: string;
  status: BlockStatus;
}
