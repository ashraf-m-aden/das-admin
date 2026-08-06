import { UUID, Block, BlockStatus, Lot } from '../../models/das.models';

export interface BlockListQuery {
  search: string;
  status: BlockStatus | null;
  adminUnitId: UUID | null;
}

export interface BlockWithLots extends Block {
  lots: Lot[];
}

/**
 * FeatureCollection GeoJSON standard, utilisée uniquement en mode mock pour
 * construire l'overlay carte côté client (voir blocks-map.component.ts).
 * En mode réel, la carte utilise les tuiles vectorielles Martin — cette
 * conversion n'intervient jamais côté serveur.
 */
export interface BlockGeoJsonProperties {
  id: UUID;
  code: string;
  status: BlockStatus;
}
