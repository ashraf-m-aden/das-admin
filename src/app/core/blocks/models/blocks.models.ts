import { UUID, Block, BlockStatus, AddressWorkflowStage, GeoJSONMultiPolygon } from '../../models/das.models';
import { HierarchySelection } from '../../hierarchy/models/hierarchy.models';

/**
 * Requête de listing des blocs. Le filtre hiérarchie (cascade
 * City→Commune→Zone→Quartier) remplace l'ancien `adminUnitId` unique.
 */
export interface BlockListQuery extends HierarchySelection {
  search: string;
  status: BlockStatus | null;
}

/** Résumé léger d'une parcelle pour la fiche détail d'un bloc. */
export interface BlockParcelSummary {
  id: UUID;
  numero: string;
  workflowStage: AddressWorkflowStage;
}

/** Étapes considérées comme « vérifiées » pour le calcul de progression. */
export const VERIFIED_STAGES: AddressWorkflowStage[] = ['verified', 'approved', 'published'];

/**
 * Bloc enrichi pour la liste : nom d'agent + compteurs de PARCELLES.
 * `geom` est OPTIONNEL : présent en mode mock (overlay GeoJSON local), absent
 * en mode réel où la géométrie provient des tuiles Martin (source `blocs`).
 */
export interface BlockListItem extends Omit<Block, 'geom'> {
  assignedUserName: string | null;
  parcelsVerified: number;
  parcelsTotal: number;
  geom?: GeoJSONMultiPolygon;
}

/** Bloc + ses parcelles (le Lot a disparu : la parcelle EST l'adresse). */
export interface BlockWithParcels extends Block {
  parcels: BlockParcelSummary[];
}

export interface BlockGeoJsonProperties {
  id: UUID;
  code: string;
  status: BlockStatus;
}
