import { UUID } from '../../models/das.models';

/**
 * Regroupement de blocs à l'intérieur d'un quartier — niveau de hiérarchie introduit le
 * 2026-08-23 : `City → [Commune] → [Zone] → Quartier → Close → Bloc → Adresse`.
 *
 * Un bloc appartient à UNE seule close, une close à UN seul quartier.
 * `number` est le 3ᵉ segment du code d'adresse (`77-007-3-7-42`) — c'est le champ structurant.
 * Voir `docs/plans/adressage.md`.
 *
 * Pas de champ `code` : `Quartier.Code`/`Bloc.Code` sont historiques et ne participent plus à
 * la chaîne d'identification, un équivalent ici n'aurait aucun consommateur.
 */
export interface Close {
  id: UUID;
  name: string;
  /** 1..N, unique dans le quartier. Entre dans le code d'adresse. */
  number: number;
  quartierId: UUID;
  /** Contenu. La géométrie de la close est l'union de ces blocs, jamais stockée (calculée à la volée). */
  blocIds: UUID[];
}

export interface CloseListQuery {
  quartierId: UUID | null;
  search: string;
}

export interface SaveClosePayload {
  name: string;
  number: number;
  quartierId: UUID;
  blocIds: UUID[];
}
