import { UUID, Block, BlockStatus, AddressWorkflowStage } from '../../models/das.models';

export interface BlockListQuery {
  search: string;
  status: BlockStatus | null;
  adminUnitId: UUID | null;
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
 * Progression = parcelsVerified / parcelsTotal. Fourni par l'endpoint enrichi.
 */
export interface BlockListItem extends Block {
  assignedUserName: string | null;
  parcelsVerified: number;
  parcelsTotal: number;
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
