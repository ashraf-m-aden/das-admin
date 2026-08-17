import type { MultiPolygon, Point, Polygon } from 'geojson';
import type { FilterSpecification } from 'maplibre-gl';

export type MapGeometry = Point | Polygon | MultiPolygon;

/** Une entité à afficher sur la carte (overlay GeoJSON). La couleur est résolue par l'appelant. */
export interface MapFeature {
  id: string;
  layerId: string;         // rattache l'entité à une couche déclarée
  geometry: MapGeometry;
  color: string;           // hex résolu (par statut, type, etc.)
  label?: string;          // affiché dans la popup au clic
  selectable?: boolean;    // défaut: true
}

/** Déclaration d'une couche overlay GeoJSON (toggle + type de rendu). */
export interface MapLayerConfig {
  id: string;
  labelKey: string;        // clé i18n pour le contrôle de couches
  type: 'point' | 'fill';
  visible: boolean;        // état initial
}

/**
 * État visuel d'une feature de tuile, appliqué via `feature-state`.
 * Tous les champs sont OPTIONNELS : la couleur de base est BAKÉE dans la tuile
 * (attribut `status` + expression `match` du style). On ne pilote via feature-state
 * que ce qui est éphémère / live :
 *   - `colorOverride` : recolore un bloc instantanément (ex. changement de statut) sans rebuild ;
 *   - `selected`      : surbrillance de sélection ;
 *   - `hidden`        : masquage individuel (opacité 0).
 * `setFeatureState` FUSIONNE ; das-map retire l'état des ids qui quittent la map.
 */
export interface TileFeatureState {
  colorOverride?: string;
  selected?: boolean;
  hidden?: boolean;
}

/** Map `featureId -> état`, pour une couche tuile donnée (clé = id du binding). */
export type TileFeatureStateMap = Record<string, TileFeatureState>;

/**
 * Liaison vers une couche vecteur-tuile du STYLE DE BASE (servie par Martin),
 * rendue interactive : toggle, coloriage feature-state, filtre data-driven, clic.
 * L'`id` sert de clé dans `tileFeatureStates` / `tileFilters` et ne doit PAS
 * entrer en collision avec un `MapLayerConfig.id` ou un `BasemapLayerGroup.id`.
 */
export interface TileLayerBinding {
  id: string;
  labelKey: string;
  source: string;               // id de source du style de base (ex. 'blocs')
  sourceLayer: string;          // source-layer MVT (ex. 'Blocs')
  styleLayerIds: string[];      // couches du style à toggler/filtrer ensemble
  interactiveLayerId: string;   // couche recevant clic/hover (en général le fill)
  visible: boolean;
}

/** Filtre appliqué à une couche tuile (`null` = aucun filtre, tout visible). */
export type TileFilter = FilterSpecification | null;
