import { UUID, ISODateTime, BlockStatus } from '../../models/das.models';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

/** Une proposition de nom (agent terrain), en attente ou déjà traitée par un superviseur/admin. */
export interface NameSuggestion {
  id: UUID;
  suggestedName: string;
  comment: string | null;
  status: SuggestionStatus;
  proposedByName: string;
  proposedAt: ISODateTime;
  reviewedByName: string | null;
  reviewedAt: ISODateTime | null;
  rejectionReason: string | null;
}

export interface BlockToName {
  id: UUID;
  code: string;
  name: string | null;
  /** Suggestion en attente de traitement, s'il y en a une — au plus une à la fois (contrainte backend). */
  pendingSuggestion: NameSuggestion | null;
  status: BlockStatus;
}

export interface BlockNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

/** Reprend exactement l'enum backend (Streets.Type) — pas une table pilotable, contrairement à ROAD_TYPES initialement prévu. */
export type StreetType = 'Rue' | 'Avenue' | 'Boulevard' | 'Piste' | 'Impasse' | 'Route';

export interface StreetToName {
  id: UUID;
  code: string;
  name: string | null;
  type: StreetType;
  pendingSuggestion: NameSuggestion | null;
}

export interface StreetNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

export interface AdminHierarchy {
  region: string;
  commune: string;
  arrondissement: string | null;
  quartier: string;
}

export interface PropertyToNumber {
  id: UUID;
  blockCode: string;
  blockName: string | null;
  lotCode: string | null;
  houseNumber: string;

  quartierName: string;
  cityName: string;
  adminHierarchy: AdminHierarchy;

  addressCode: string;
  /** Calculé côté API (EF Core, jointure Adresses→Lots→Blocs→Quartiers→Communes) — jamais recalculé ni stocké côté frontend. */
  formattedAddress: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_redo';
}

export interface AssignHouseNumberPayload {
  houseNumber: string;
}

export interface PropertyNumberingQuery {
  blockId: UUID | null;
}
