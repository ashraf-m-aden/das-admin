import { UUID, Block, BlockStatus, Lot } from '../../models/das.models';

export interface BlockListQuery {
  search: string;
  status: BlockStatus | null;
  adminUnitId: UUID | null;
}

/**
 * Bloc enrichi pour l'affichage en liste : nom d'agent lisible + compteurs de
 * lots. Fourni par l'endpoint liste enrichi (voir demande backend §3).
 */
export interface BlockListItem extends Block {
  assignedUserName: string | null;
  lotsCompleted: number;
  lotsTotal: number;
}

export interface BlockWithLots extends Block {
  lots: Lot[];
}

export interface BlockGeoJsonProperties {
  id: UUID;
  code: string;
  status: BlockStatus;
}
