import { UUID } from '../../models/das.models';

export type UnitType = 'Apartment' | 'Shop' | 'Office';

/** Unité d'immeuble (`/api/units?adresseId=`) — vide pour une maison individuelle. Lecture seule ici : la saisie/édition se fait terrain (AgentTerrain). */
export interface AddressUnit {
  id: UUID;
  floor: number;
  number: string;
  type: UnitType;
}
