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

/** Zone postale — regroupe des quartiers. Sert au coloriage de fond de la carte. */
export interface ZoneOption {
  id: UUID;
  name: string;
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

export interface UpdateCityCodePayload {
  current: CityPostcodeRow;
  code: number;
}
