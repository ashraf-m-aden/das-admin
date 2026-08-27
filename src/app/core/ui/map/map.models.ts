import type { MultiPolygon, Point, Polygon } from 'geojson';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';

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
  /**
   * Affiche `label` en permanence à côté de la feature, au lieu de le réserver à la popup au clic.
   * Réservé aux cas où le libellé EST l'information à vérifier — la numérotation proposée d'une
   * close, par exemple, qui ne se relit qu'en voyant les numéros dans l'ordre sur la carte.
   * Ailleurs, c'est du bruit qui se superpose au fond.
   */
  showLabels?: boolean;
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
  /**
   * Couche recevant clic/hover (en général le fill). **Omis = calque en lecture seule** : il se
   * toggle et se filtre, mais ne reçoit aucun clic. Sans cette option, un calque d'affichage
   * devrait déclarer une couche interactive factice — et le clic remonterait alors un id
   * étranger (une adresse là où l'écran attend un bloc) au lieu de ne rien faire.
   */
  interactiveLayerId?: string;
  visible: boolean;
  /**
   * `false` = le binding ne pilote PAS la visibilité : absent du panneau, ignoré par
   * `applyVisibility`.
   *
   * Sert quand un binding n'existe que pour l'interaction (clic, feature-state) sur des couches
   * dont un `BasemapLayerGroup` possède déjà la case à cocher. Sans ce garde-fou, les deux
   * entrées pilotent les mêmes `styleLayerIds` et le panneau affiche deux cases au même
   * libellé, dont une inopérante : `applyVisibility` traite les groupes de fond APRÈS les
   * tuiles, donc le groupe réécrit systématiquement ce que la tuile vient de poser.
   */
  togglable?: boolean;
}

/** Filtre appliqué à une couche tuile (`null` = aucun filtre, tout visible). */
export type TileFilter = FilterSpecification | null;

/**
 * Recoloration d'une couche tuile par une expression lue sur ses PROPRES attributs
 * (`['match', ['get','ZoneId'], …]`), `null` = retour à la coloration bakée dans le style.
 *
 * À distinguer de `TileFeatureState.colorOverride`, qui colore feature par feature et suppose
 * qu'on connaisse déjà l'id de chacune. Quand le critère est un attribut que la tuile porte
 * déjà — la zone d'un bloc, par exemple — l'expression évite d'aller redemander à l'API une
 * correspondance que la tuile contient.
 */
export type TileFillColor = ExpressionSpecification | string | null;
