import type { Polygon } from 'geojson';
import type { UUID } from '../../models/das.models';

/** City → Commune → Zone → Quartier → Bloc (→ Adresse). */
export type HierarchyLevel = 'city' | 'commune' | 'zone' | 'quartier' | 'bloc';

export type Bbox4326 = [number, number, number, number];

export interface HierarchyNode {
  id: UUID;
  level: HierarchyLevel;
  code: string;
  name: string;
  nom?: string;
  parentId: UUID | null;
  bbox?: Bbox4326;
}

export interface HierarchyBoundary {
  id: UUID;
  level: HierarchyLevel;
  boundary: Polygon;
}

/** Sélection de la cascade. `null` = « tous ». `blocId` optionnel (5e niveau). */
export interface HierarchySelection {
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
  blocId: UUID | null;
}

export const EMPTY_HIERARCHY_SELECTION: HierarchySelection = {
  cityId: null, communeId: null, zoneId: null, quartierId: null, blocId: null,
};
