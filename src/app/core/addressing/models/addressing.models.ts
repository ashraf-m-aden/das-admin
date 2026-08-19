import { UUID, ISODateTime, UpdateBlockPayload } from '../../models/das.models';

/**
 * Bloc à nommer directement par un admin — `GET /api/blocs` filtré côté front, à l'EXCLUSION
 * des blocs ayant une suggestion terrain en attente : ceux-là se traitent dans la file de
 * validation unifiée (`/verification`), pas ici. Pas de `status` : ce champ n'existe pas sur
 * `BlocResponse`.
 */
export interface BlockToName {
  id: UUID;
  code: string;
  name: string | null;
  /** `null` sur les blocs antérieurs au 2026-08-18 — renommage refusé tant qu'il n'est pas repris (cf. `blocks.missingNumberHint`). */
  number: number | null;
  boundaryWkt: string | null;
}

export interface BlockNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

/** Ligne de la file plate `/api/blocs/suggestions?status=Pending` — consommée par l'écran review, et par le nommage direct pour exclure les blocs déjà en attente de décision. */
export interface PendingBlockSuggestion {
  id: UUID;
  blocId: UUID;
  suggestedName: string;
  comment: string | null;
  proposedAtUtc: ISODateTime;
}

/** Reprend l'enum backend (Streets.Type). */
export type StreetType = 'Rue' | 'Avenue' | 'Boulevard' | 'Piste' | 'Impasse' | 'Route';

/** Rue à nommer directement par un admin — mêmes règles que `BlockToName` (§ ci-dessus). */
export interface StreetToName {
  id: UUID;
  code: string;
  name: string | null;
  type: StreetType;
  boundaryWkt: string | null;
}

export interface StreetNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

/** Ligne de la file plate `/api/streets/suggestions?status=Pending` — consommée par l'écran review, et par le nommage direct pour exclure les rues déjà en attente de décision. */
export interface PendingStreetSuggestion {
  id: UUID;
  streetId: UUID;
  suggestedName: string;
  comment: string | null;
  proposedAtUtc: ISODateTime;
}

/** `PATCH /api/streets/{id}` — dossier complet (lecture-modification-écriture, comme les blocs). */
export interface UpdateStreetNamePayload {
  code: string;
  name: string | null;
  type: StreetType;
  boundaryWkt: string | null;
}

export type { UpdateBlockPayload };

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
