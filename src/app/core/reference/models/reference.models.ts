import { UUID } from '../../models/das.models';

/** Élément d'un catalogue de référence (`/api/types-occupation`, `/api/etats-occupation`) — lecture seule, seedé au démarrage back. */
export interface OccupationCatalogItem {
  id: UUID;
  nom: string;
}
