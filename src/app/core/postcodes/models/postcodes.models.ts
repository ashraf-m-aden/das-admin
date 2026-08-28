import { UUID } from '../../models/das.models';

/**
 * Le code postal ne se stocke jamais : `City.Code` (2 chiffres) + `Quartier.AreaNumber`
 * (3 chiffres). Le back le calcule et le renvoie déjà résolu — `postcode` se LIT, jamais
 * recomposé côté front (CLAUDE.md §9). `null` est un état réel et fréquent, jamais à combler.
 */
export interface QuartierPostcodeRow {
  id: UUID;
  nom: string;
  /** Code du quartier (ex. "GB") — distinct du code postal, ne pas confondre à l'affichage. */
  code: string;
  areaNumber: number | null;
  postcode: string | null;
  cityId: UUID;
  communeId: UUID | null;
  zoneId: UUID | null;
  /** Emprise du quartier (POLYGON WKT, SRID 4326). `null` sur les quartiers sans délimitation. */
  boundaryWkt: string | null;
}

/**
 * Zone postale — regroupe des quartiers d'UNE commune. Sert au coloriage de fond de la carte
 * et au rattachement des quartiers.
 *
 * `communeId` n'est pas décoratif : une zone est une PARTIE d'une commune, jamais un parent
 * alternatif. C'est lui qui dit quels quartiers peuvent la rejoindre — le back refuse le reste
 * en `Quartiers.ZoneOutsideCommune`. Le libellé de la chaîne de rattachement est renvoyé par
 * `GET /api/zones`, ce qui évite une cascade d'appels pour afficher « Boulaos 3 · Boulaos ».
 */
export interface ZoneRow {
  id: UUID;
  name: string;
  code: string;
  communeId: UUID;
  communeName: string;
  cityId: UUID | null;
  cityName: string;
  /** Composition renvoyée par l'API, en lecture seule : on rattache DEPUIS le quartier. */
  quartierCount: number;
}

export interface CityPostcodeRow {
  id: UUID;
  name: string;
  code: number | null;
}

/** `current` porte les champs non modifiés du remplacement complet (PATCH exige nom/rattachement). */
export interface UpdateQuartierAreaNumberPayload {
  current: QuartierPostcodeRow;
  areaNumber: number;
}

/**
 * Rattachement d'un quartier à une zone, ou détachement avec `zoneId: null`.
 *
 * Il n'existe pas de `POST /api/zones { quartierIds }` : la composition d'une zone se modifie
 * un quartier à la fois, depuis le quartier. Ce n'est pas une limite de l'API, c'est la forme
 * du domaine — le rattachement appartient au quartier.
 */
export interface AssignQuartierZonePayload {
  current: QuartierPostcodeRow;
  zoneId: UUID | null;
}

export interface UpdateCityCodePayload {
  current: CityPostcodeRow;
  code: number;
}
