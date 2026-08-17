import type { Polygon } from 'geojson';
import type { UUID } from '../../models/das.models';

/**
 * Hiérarchie géographique de la NOUVELLE base :
 *   City → Commune → Zone → Quartier → Bloc → Adresse
 * Entités concrètes (tables Cities/Communes/Zones/Quartiers), en remplacement
 * de l'ancien AdministrativeUnit générique (ltree) de das.models.
 *
 * ⚠️ « Zone » ICI = maillon de hiérarchie (table "Zones", FK CommuneId).
 *    À NE PAS confondre avec l'interface `Zone` de das.models (zone POSTALE,
 *    orthogonale, qui porte le code postal). Deux concepts, même mot.
 */
export type HierarchyLevel = 'city' | 'commune' | 'zone' | 'quartier';

/** [minLng, minLat, maxLng, maxLat] en EPSG:4326 — pour fitBounds sans charger la Boundary. */
export type Bbox4326 = [number, number, number, number];

/** Nœud générique renvoyé par les endpoints de listing léger (selects en cascade). */
export interface HierarchyNode {
  id: UUID;
  level: HierarchyLevel;
  code: string;
  name: string;          // "Nom" (Quartiers) / "Name" (autres) — normalisé côté API
  parentId: UUID | null; // CityId / CommuneId / ZoneId selon le niveau
  bbox?: Bbox4326;       // fitBounds ; absent si non calculé (ST_Extent côté API)
}

/** Boundary complète — chargée à la demande, jamais dans les listes de selects. */
export interface HierarchyBoundary {
  id: UUID;
  level: HierarchyLevel;
  boundary: Polygon;
}

/**
 * Sélection courante de la cascade. `null` = « tous ». Source unique pour :
 *   - le fitBounds (niveau non-null le plus profond) ;
 *   - le setFilter sur la couche tuile Blocs (via FK dénormalisées) ;
 *   - le filtre serveur de la liste (BlocksFilters).
 */
export interface HierarchySelection {
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
}

export const EMPTY_HIERARCHY_SELECTION: HierarchySelection = {
  cityId: null, communeId: null, zoneId: null, quartierId: null,
};
