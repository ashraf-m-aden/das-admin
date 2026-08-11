import type { MultiPolygon, Point, Polygon } from 'geojson';

export type MapGeometry = Point | Polygon | MultiPolygon;

/** Une entité à afficher sur la carte. La couleur est résolue par l'appelant. */
export interface MapFeature {
  id: string;
  layerId: string;         // rattache l'entité à une couche déclarée
  geometry: MapGeometry;
  color: string;           // hex résolu (par statut, type, etc.)
  label?: string;          // affiché dans la popup au clic
  selectable?: boolean;    // défaut: true
}

/** Déclaration d'une couche (toggle + type de rendu). */
export interface MapLayerConfig {
  id: string;
  labelKey: string;        // clé i18n pour le contrôle de couches
  type: 'point' | 'fill';
  visible: boolean;        // état initial
}
