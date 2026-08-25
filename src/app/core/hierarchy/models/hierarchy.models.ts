import type { Polygon } from 'geojson';
import type { UUID } from '../../models/das.models';

/**
 * City → Commune → Zone → Quartier → Close (→ Adresse).
 *
 * `bloc` reste un niveau de la HIÉRARCHIE du domaine, mais plus un niveau de FILTRE : il a été
 * retiré de la cascade le 2026-08-25 (cf. `HierarchyCascadeComponent`). Le back continue de
 * renvoyer des nœuds `bloc`, que seul l'écran des closes consomme, comme données.
 */
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
 *
 * `closeId` est le niveau le plus fin : c'est la close qui nomme l'adresse depuis le passage du
 * code à quatre segments. Le niveau bloc a été retiré le 2026-08-25 — un bloc est une unité de
 * TRAVAIL (affectation de campagne), pas un critère d'adressage.
 */
export interface HierarchySelection {
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
  closeId: UUID | null;
}

export const EMPTY_HIERARCHY_SELECTION: HierarchySelection = {
  cityId: null, communeId: null, zoneId: null, quartierId: null, closeId: null,
};
