import type { Polygon } from 'geojson';
import type { UUID } from '../../models/das.models';

/** City → Commune → Zone → Quartier → Close → Bloc (→ Adresse). */
export type HierarchyLevel = 'city' | 'commune' | 'zone' | 'quartier' | 'close' | 'bloc';

export type Bbox4326 = [number, number, number, number];

export interface HierarchyNode {
  id: UUID;
  level: HierarchyLevel;
  code: string;
  name: string;
  parentId: UUID | null;
  bbox?: Bbox4326;
  /**
   * Sur un nœud `bloc` uniquement : la close de rattachement, `null` tant que le bloc n'y est pas
   * rattaché. Sert à filtrer les blocs par close **côté front** — le back n'expose pas
   * `GET /api/blocs?closeId=`, seulement `?quartierId=`.
   */
  closeId?: UUID | null;
}

export interface HierarchyBoundary {
  id: UUID;
  level: HierarchyLevel;
  boundary: Polygon;
}

/**
 * Sélection de la cascade. `null` = « tous ».
 * `closeId` est un **raffinement optionnel** entre quartier et bloc, au même titre que commune et
 * zone : il se masque quand le quartier n'a aucune close (état normal tant que la reprise de
 * données n'a pas eu lieu — sinon le select bloc deviendrait inutilisable).
 */
export interface HierarchySelection {
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
  closeId: UUID | null;
  blocId: UUID | null;
}

export const EMPTY_HIERARCHY_SELECTION: HierarchySelection = {
  cityId: null, communeId: null, zoneId: null, quartierId: null, closeId: null, blocId: null,
};
