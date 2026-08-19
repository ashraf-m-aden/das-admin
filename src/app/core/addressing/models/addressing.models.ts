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
  pendingSuggestion: NameSuggestion | null;
  status: BlockStatus;
}

export interface BlockNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

/** Ligne de la file plate `/api/blocs/suggestions?status=Pending` — consommée par l'écran review. */
export interface PendingBlockSuggestion {
  id: UUID;
  blocId: UUID;
  suggestedName: string;
  comment: string | null;
  proposedAtUtc: ISODateTime;
}

/** Reprend l'enum backend (Streets.Type). */
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

/** Ligne de la file plate `/api/streets/suggestions?status=Pending` — consommée par l'écran review. */
export interface PendingStreetSuggestion {
  id: UUID;
  streetId: UUID;
  suggestedName: string;
  comment: string | null;
  proposedAtUtc: ISODateTime;
}

/** Hiérarchie de rattachement — Region → Ville → Commune → Quartier (plus d'arrondissement). */
export interface AdminHierarchy {
  region: string;
  ville: string;
  commune: string;
  quartier: string;
}

/**
 * Parcelle à consulter/ajuster. Le `numero` est généré automatiquement à
 * l'import (séquentiel par bloc) ; l'écran sert surtout à la consultation, avec
 * possibilité d'ajustement ponctuel. Plus de lot (la parcelle EST l'adresse).
 */
export interface PropertyToNumber {
  id: UUID;
  blockCode: string;
  blockName: string | null;
  numero: string;

  quartierName: string;
  cityName: string;
  adminHierarchy: AdminHierarchy;

  addressCode: string;
  /** Calculé côté API (jointure Adresses→Blocs→Quartiers→…→Region) — jamais recalculé côté frontend. */
  formattedAddress: string;
  status: 'draft' | 'submitted' | 'approved' | 'needs_redo';
}

/** Ajustement ponctuel du numéro (correction) — le numéro initial reste auto-généré. */
export interface AssignHouseNumberPayload {
  numero: string;
}

export interface PropertyNumberingQuery {
  blockId: UUID | null;
}
