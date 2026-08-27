import {
  Component, DestroyRef, ElementRef, NgZone, OnDestroy, OnInit,
  computed, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { Feature, FeatureCollection } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { AppConfigService } from '../../config/app-config.service';
import { MapStyleService } from '../../map/map-style.service';
import {
  MapFeature, MapLayerConfig, TileFeatureStateMap, TileFillColor, TileFilter, TileLayerBinding,
} from './map.models';

const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const HIGHLIGHT = '#2563eb';
const NONE = '___none___';

/**
 * Couches de voirie du fond de carte à CONSERVER quand `basemapRoadsOnly` est actif.
 * Testé sur l'id de couche : les schémas OpenMapTiles (CARTO Positron) nomment
 * `road_*`, mais aussi `bridge_*` / `tunnel_*` pour les mêmes tronçons — les omettre
 * troue le réseau aux ponts et tunnels. Les libellés de rue (`roadname_*`) sont des
 * couches `symbol` : elles matchent aussi et sont conservées.
 */
const BASEMAP_ROAD_LAYER_ID = /road|street|highway|motorway|trunk|primary|secondary|tertiary|bridge|tunnel/i;

/** Voie ferrée / ferry / téléphérique : matchent `tunnel_*` ou `bridge_*` sans être de la voirie. */
const BASEMAP_NON_ROAD_LAYER_ID = /rail|ferry|aerialway|pier/i;

/**
 * Sources de DONNÉES D.A.S dans `map-style.json` (à distinguer du fond de carte).
 * Aucune couche adossée à ces sources n'est jamais masquée par `basemapRoadsOnly` :
 * plusieurs écrans (dashboard, rapports) affichent ces tuiles SANS déclarer de
 * `TileLayerBinding` — s'appuyer sur les seuls bindings les ferait disparaître.
 *
 * `streets` a rejoint la liste le 2026-08-25, quand la voirie CARTO a été remplacée par la
 * table `Streets` du référentiel. Ses couches survivraient aussi au filtre par accident (leurs
 * ids contiennent « street », que la regex ci-dessus laisse passer) — mais dépendre d'une
 * coïncidence de nommage pour ne pas effacer nos propres données serait une bombe à retardement.
 */
const DAS_TILE_SOURCES = new Set(['streets', 'closes', 'blocs', 'adresses']);

/**
 * Groupe de couches issues du STYLE DE BASE (map-style.json) que l'on peut
 * afficher/masquer ensemble via une seule case à cocher.
 * À distinguer de MapLayerConfig, qui pilote l'overlay GeoJSON dynamique.
 */
export interface BasemapLayerGroup {
  /** Identifiant logique unique (ne doit pas entrer en collision avec un MapLayerConfig.id). */
  id: string;
  /** Clé i18n du libellé affiché dans le panneau des couches. */
  labelKey: string;
  /** IDs des couches du style de base à basculer ensemble (ex. ['ilots-fill', 'ilots-line']). */
  styleLayerIds: string[];
  /** Visibilité initiale. */
  visible: boolean;
}

interface PanelItem { id: string; labelKey: string; }

@Component({
  selector: 'das-map',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './das-map.component.html',
  styleUrl: './das-map.component.scss',
})
export class DasMapComponent implements OnInit, OnDestroy {
  readonly features = input<MapFeature[]>([]);
  readonly layers = input<MapLayerConfig[]>([]);
  readonly basemapLayers = input<BasemapLayerGroup[]>([]);

  /** Couches vecteur-tuiles interactives (Blocs, Adresses…) du style de base. */
  readonly tileLayers = input<TileLayerBinding[]>([]);
  /** feature-state par binding : { [bindingId]: { [featureId]: état } }. */
  readonly tileFeatureStates = input<Record<string, TileFeatureStateMap>>({});
  /** Filtre data-driven par binding : { [bindingId]: expression | null }. */
  readonly tileFilters = input<Record<string, TileFilter>>({});
  /** Recoloration par binding, lue sur les attributs de la tuile : { [bindingId]: expression | null }. */
  readonly tileFillColors = input<Record<string, TileFillColor>>({});

  readonly center = input<[number, number]>([43.145, 11.595]);
  readonly zoom = input<number>(12);
  readonly fitToData = input<boolean>(true);
  /** Emprise [minLng, minLat, maxLng, maxLat] à recadrer (prioritaire sur fitToData). */
  readonly fitBbox = input<[number, number, number, number] | null>(null);
  readonly selectedId = input<string | null>(null);
  readonly showLayerControl = input<boolean>(true);
  /**
   * Réduit le fond de carte à la seule voirie : toutes les autres couches du style
   * de base (bâti, POI, eau, limites, libellés) passent en `visibility: none`.
   * Ne touche jamais aux couches de D.A.S (overlays GeoJSON, tuiles Martin).
   */
  readonly basemapRoadsOnly = input<boolean>(true);

  readonly featureSelect = output<string>();

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private readonly mapStyle = inject(MapStyleService);
  private readonly config = inject(AppConfigService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private map?: maplibregl.Map;
  private popup?: maplibregl.Popup;
  private resizeObserver?: ResizeObserver;
  private loaded = false;

  /**
   * Signature du dernier jeu de features recadré. On ne recadre que si l'ensemble
   * des id géométriques change (filtre, page). Inchangé au clic / highlight → pas
   * de recadrage intempestif.
   */
  private lastFitKey = '';

  /** feature-state déjà posés, par binding, pour ne retirer que ce qui disparaît. */
  private readonly appliedTileStateIds = new Map<string, Set<string>>();

  /** Coloration d'origine par couche de style, pour pouvoir la restaurer à l'identique. */
  private readonly bakedFillColors = new Map<string, unknown>();

  private readonly isMockMode = this.config.get('useMockApi');

  protected readonly initError = signal(false);
  protected readonly panelOpen = signal(false);
  protected readonly visibility = signal<Record<string, boolean>>({});

  private readonly internalSelected = signal<string | null>(null);

  /** Éléments listés dans le panneau : overlays, puis couches tuiles, puis fond cadastral. */
  protected readonly panelLayers = computed<PanelItem[]>(() => [
    ...this.layers().map((l) => ({ id: l.id, labelKey: l.labelKey })),
    ...this.tileLayers().filter((t) => t.togglable !== false).map((t) => ({ id: t.id, labelKey: t.labelKey })),
    ...this.basemapLayers().map((b) => ({ id: b.id, labelKey: b.labelKey })),
  ]);

  constructor() {
    // Init visibilité depuis la config des couches (overlay + tuiles + fond cadastral)
    effect(() => {
      const map: Record<string, boolean> = {};
      for (const l of this.layers()) map[l.id] = l.visible;
      for (const t of this.tileLayers()) if (t.togglable !== false) map[t.id] = t.visible;
      for (const b of this.basemapLayers()) map[b.id] = b.visible;
      this.visibility.set(map);
    });
    // Sync sélection contrôlée depuis le parent
    effect(() => { this.internalSelected.set(this.selectedId()); });
    // Re-rendu des données overlay
    effect(() => { const f = this.features(); if (this.loaded) this.renderFeatures(f); });
    // Couches overlay déclarées APRÈS le chargement du style. `buildLayers` ne tournait qu'une
    // fois, à l'initialisation : un écran qui n'expose son calque qu'à partir d'un certain état
    // (le plan de numérotation, révélé par un aperçu) n'obtenait jamais sa source, et son
    // overlay restait invisible sans qu'aucune erreur ne le signale.
    effect(() => {
      const declared = this.layers();
      if (!this.loaded) return;
      this.buildLayers(declared);             // idempotent : ne matérialise que les nouvelles
      this.renderFeatures(this.features());   // vide au passage les couches devenues orphelines
      this.applyVisibility(this.visibility()); // une couche neuve n'a pas encore d'entrée
    });
    // Application de la visibilité
    effect(() => { const v = this.visibility(); if (this.loaded) this.applyVisibility(v); });
    // Application du highlight overlay
    effect(() => { const sel = this.internalSelected(); if (this.loaded) this.applyHighlight(sel); });
    // Application des feature-state sur les couches tuiles
    effect(() => { const s = this.tileFeatureStates(); if (this.loaded) this.applyTileFeatureStates(s); });
    // Application des filtres sur les couches tuiles
    effect(() => { const f = this.tileFilters(); if (this.loaded) this.applyTileFilters(f); });
    // Recoloration des couches tuiles
    effect(() => { const c = this.tileFillColors(); if (this.loaded) this.applyTileFillColors(c); });
    // Recadrage sur emprise explicite (cascade hiérarchie)
    effect(() => { const b = this.fitBbox(); if (this.loaded && b) this.applyFitBbox(b); });
  }

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.isMockMode) this.initMap(MOCK_BASEMAP_STYLE_URL);
      else this.mapStyle.getStyle().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => this.initMap(s));
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.popup?.remove();
    this.map?.remove();
    this.map = undefined;
  }

  togglePanel(): void { this.panelOpen.update((o) => !o); }

  toggleLayer(id: string): void {
    this.visibility.update((v) => ({ ...v, [id]: !v[id] }));
  }

  isVisible(id: string): boolean { return this.visibility()[id] ?? true; }

  private initMap(style: maplibregl.StyleSpecification | string): void {
    const map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style, center: this.center(), zoom: this.zoom(),
    });
    this.map = map;

    map.on('error', (e) => {
      console.error('[das-map] MapLibre error:', e.error);
      this.ngZone.run(() => this.initError.set(true));
    });

    this.resizeObserver = new ResizeObserver(() => { if (this.map && !this.initError()) this.map.resize(); });
    this.resizeObserver.observe(this.mapContainer().nativeElement);

    map.on('load', () => {
      // AVANT buildLayers : à ce stade le style ne contient que le fond de carte,
      // aucune de nos couches overlay ne peut être masquée par erreur.
      if (this.basemapRoadsOnly()) this.hideNonRoadBasemapLayers();
      this.buildLayers();
      this.wireTileInteractions();
      this.loaded = true;
      map.resize();
      this.renderFeatures(this.features());
      this.applyVisibility(this.visibility());
      this.applyHighlight(this.internalSelected());
      this.applyTileFilters(this.tileFilters());
      this.applyTileFillColors(this.tileFillColors());
      this.applyTileFeatureStates(this.tileFeatureStates());
      const bbox = this.fitBbox();
      if (bbox) this.applyFitBbox(bbox);
    });
  }

  /**
   * Masque toutes les couches du STYLE DE BASE sauf la voirie : les lignes de
   * tronçons ET les libellés de rue (`roadname_*`, couches `symbol`).
   * - `background` est conservé (sinon le canvas devient transparent) ;
   * - les couches déclarées par `tileLayers` / `basemapLayers` (Blocs, Adresses,
   *   contours cadastraux) sont exclues : leur visibilité reste pilotée par le
   *   panneau des couches, pas par ce filtre.
   * En mode réel, depuis le 2026-08-25, le style maison ne contient PLUS de fond de carte tiers :
   * la voirie vient de la table `Streets` via la source `streets`, protégée par
   * `DAS_TILE_SOURCES`. La méthode n'a donc plus rien à masquer — elle reste en place pour le
   * mode mock, qui charge un vrai style CARTO complet (`MOCK_BASEMAP_STYLE_URL`).
   */
  private hideNonRoadBasemapLayers(): void {
    const map = this.map!;
    const ours = new Set<string>([
      ...this.tileLayers().flatMap((t) => t.styleLayerIds),
      ...this.basemapLayers().flatMap((b) => b.styleLayerIds),
    ]);

    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type === 'background' || ours.has(layer.id)) continue;
      const source = 'source' in layer ? layer.source : undefined;
      if (typeof source === 'string' && DAS_TILE_SOURCES.has(source)) continue;

      const isRoad =
        (layer.type === 'line' || layer.type === 'symbol') &&
        BASEMAP_ROAD_LAYER_ID.test(layer.id) &&
        !BASEMAP_NON_ROAD_LAYER_ID.test(layer.id);
      if (!isRoad) map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }

  /**
   * Couches overlay déjà matérialisées sur la carte. `layers()` peut CHANGER en cours de vie —
   * un écran n'expose son calque de plan que pendant un aperçu — alors que les sources MapLibre,
   * elles, ne se recréent pas. Ce registre sert deux choses : ne jamais reconstruire une couche
   * existante (ce qui réenregistrerait ses gestionnaires de clic, donc doublerait les
   * émissions), et retrouver les couches devenues orphelines pour les vider.
   */
  private readonly builtLayerIds = new Set<string>();

  /** Crée une source (vide) + les couches de rendu et de highlight pour chaque couche déclarée. */
  private buildLayers(declared: readonly MapLayerConfig[] = this.layers()): void {
    const map = this.map!;
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

    const addLayerSafe = (config: maplibregl.LayerSpecification): void => {
      if (!map.getLayer(config.id)) map.addLayer(config);
    };

    for (const layer of declared) {
      if (this.builtLayerIds.has(layer.id)) continue;
      this.builtLayerIds.add(layer.id);
      const src = `src-${layer.id}`;
      if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: empty });

      if (layer.type === 'fill') {
        addLayerSafe({ id: `${layer.id}-fill`, type: 'fill', source: src, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.45 } });
        addLayerSafe({ id: `${layer.id}-line`, type: 'line', source: src, paint: { 'line-color': ['get', 'color'], 'line-width': 1.4 } });
        addLayerSafe({ id: `${layer.id}-sel`, type: 'line', source: src, filter: ['==', ['get', 'id'], NONE], paint: { 'line-color': HIGHLIGHT, 'line-width': 3 } });
        // Libellé au centre du polygone. Même opt-in que sur les points : réservé aux cas où le
        // libellé EST l'information à lire — un code postal sur son quartier, par exemple.
        if (layer.showLabels) {
          addLayerSafe({
            id: `${layer.id}-label`, type: 'symbol', source: src,
            layout: {
              'text-field': ['get', 'label'], 'text-size': 12,
              'text-font': ['Open Sans Regular'], 'text-allow-overlap': false,
            },
            paint: { 'text-color': '#0b1220', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
          });
        }
        this.wireInteractions(`${layer.id}-fill`);
      } else {
        addLayerSafe({ id: `${layer.id}-circle`, type: 'circle', source: src, paint: { 'circle-color': ['get', 'color'], 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
        addLayerSafe({ id: `${layer.id}-sel`, type: 'circle', source: src, filter: ['==', ['get', 'id'], NONE], paint: { 'circle-color': HIGHLIGHT, 'circle-opacity': 0.001, 'circle-radius': 8, 'circle-stroke-color': HIGHLIGHT, 'circle-stroke-width': 3 } });
        if (layer.showLabels) {
          // `glyphs` est déclaré dans map-style.json, donc le texte rend. En mode mock le fond
          // CARTO en fournit aussi — pas de régression silencieuse d'un mode à l'autre.
          addLayerSafe({
            id: `${layer.id}-label`, type: 'symbol', source: src,
            layout: {
              'text-field': ['get', 'label'], 'text-size': 12, 'text-offset': [0, 1.1],
              'text-font': ['Open Sans Regular'], 'text-allow-overlap': true,
            },
            paint: { 'text-color': '#0b1220', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
          });
        }
        this.wireInteractions(`${layer.id}-circle`);
      }
    }
  }

  private wireInteractions(layerId: string): void {
    const map = this.map!;
    map.on('click', layerId, (e) => {
      const f = e.features?.[0];
      const id = f?.properties?.['id'];
      const selectable = f?.properties?.['selectable'];
      if (!id || selectable === false) return;
      this.ngZone.run(() => {
        this.internalSelected.set(id);
        this.applyHighlight(id);
        this.featureSelect.emit(id);
        const label = f?.properties?.['label'];
        if (label) this.showPopup(e.lngLat, label);
      });
    });
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  }

  /**
   * Câble clic + curseur sur les couches tuiles interactives.
   * L'id de feature vient de `promoteId` côté source (l'UUID du bloc) : c'est
   * cette clé qui relie clic, feature-state et sélection.
   */
  private wireTileInteractions(): void {
    const map = this.map!;
    for (const binding of this.tileLayers()) {
      const layerId = binding.interactiveLayerId;
      if (!layerId) continue;   // calque en lecture seule
      map.on('click', layerId, (e) => {
        const f = e.features?.[0];
        const id = f?.id;
        if (id === undefined || id === null) return;
        this.ngZone.run(() => {
          this.featureSelect.emit(String(id));
          const label = f?.properties?.['code'];
          if (label) this.showPopup(e.lngLat, String(label));
        });
      });
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  private renderFeatures(features: MapFeature[]): void {
    if (!this.map || !this.loaded) return;

    // Ne conserver que les features réellement géométriques.
    const withGeom = (features ?? []).filter((f): f is MapFeature => !!f && !!f.geometry);

    // Itérer sur les couches CONSTRUITES et non sur les couches déclarées : une couche retirée
    // de `layers()` garderait sinon ses dernières données affichées pour toujours, personne ne
    // venant plus vider sa source.
    const byLayer = new Map<string, Feature[]>();
    for (const id of this.builtLayerIds) byLayer.set(id, []);

    for (const feat of withGeom) {
      const bucket = byLayer.get(feat.layerId);
      if (!bucket) continue;
      bucket.push({
        type: 'Feature',
        id: feat.id,
        properties: { id: feat.id, color: feat.color, label: feat.label ?? '', selectable: feat.selectable !== false },
        geometry: feat.geometry,
      });
    }

    for (const [layerId, list] of byLayer) {
      const src = this.map.getSource(`src-${layerId}`) as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features: list });
    }

    // Recadre sur les données SEULEMENT si aucune emprise explicite (fitBbox) n'est fournie,
    // et uniquement si l'ENSEMBLE des id géométriques a changé.
    if (this.fitToData() && !this.fitBbox() && withGeom.length > 0) {
      const key = withGeom.map((f) => f.id).sort().join('|');
      if (key !== this.lastFitKey) {
        this.lastFitKey = key;
        this.fitBounds(withGeom);
      }
    }
  }

  private applyVisibility(vis: Record<string, boolean>): void {
    if (!this.map || !this.loaded) return;

    // Overlays GeoJSON
    for (const l of this.layers()) {
      const value = (vis[l.id] ?? true) ? 'visible' : 'none';
      const ids = l.type === 'fill'
        ? [`${l.id}-fill`, `${l.id}-line`, `${l.id}-sel`, `${l.id}-label`]
        : [`${l.id}-circle`, `${l.id}-sel`, `${l.id}-label`];
      for (const id of ids) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
    }

    // Couches tuiles interactives — no-op silencieux en mode mock (couches absentes).
    for (const t of this.tileLayers()) {
      if (t.togglable === false) continue;   // visibilité pilotée par un groupe de fond
      const value = (vis[t.id] ?? true) ? 'visible' : 'none';
      for (const id of t.styleLayerIds) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
    }

    // Groupes du style de base (contours cadastraux) — no-op silencieux si la couche
    // n'existe pas (ex. en mode mock où le fond est CARTO Positron).
    for (const b of this.basemapLayers()) {
      const value = (vis[b.id] ?? true) ? 'visible' : 'none';
      for (const id of b.styleLayerIds) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
    }
  }

  private applyHighlight(selected: string | null): void {
    if (!this.map || !this.loaded) return;
    for (const l of this.layers()) {
      const id = `${l.id}-sel`;
      if (this.map.getLayer(id)) this.map.setFilter(id, ['==', ['get', 'id'], selected ?? NONE]);
    }
  }

  /**
   * Applique les feature-state par binding, en DIFFÉRENTIEL : on ne retire l'état
   * que des features absentes de la nouvelle map (setFeatureState fusionne le reste).
   * Persistant côté source : MapLibre le réapplique aux tuiles au fil du pan/zoom.
   */
  private applyTileFeatureStates(all: Record<string, TileFeatureStateMap>): void {
    if (!this.map || !this.loaded) return;
    const map = this.map;
    for (const binding of this.tileLayers()) {
      if (!map.getSource(binding.source)) continue;   // mode mock : source absente
      const states = all[binding.id] ?? {};
      const nextIds = new Set(Object.keys(states));
      const prevIds = this.appliedTileStateIds.get(binding.id) ?? new Set<string>();

      for (const id of prevIds) {
        if (!nextIds.has(id)) {
          map.removeFeatureState({ source: binding.source, sourceLayer: binding.sourceLayer, id });
        }
      }
      for (const [id, st] of Object.entries(states)) {
        map.setFeatureState({ source: binding.source, sourceLayer: binding.sourceLayer, id }, st);
      }
      this.appliedTileStateIds.set(binding.id, nextIds);
    }
  }

  /** Applique un filtre data-driven à toutes les couches de style d'un binding (null = tout visible). */
  private applyTileFilters(filters: Record<string, TileFilter>): void {
    if (!this.map || !this.loaded) return;
    const map = this.map;
    for (const binding of this.tileLayers()) {
      const filter = filters[binding.id] ?? null;
      for (const styleLayerId of binding.styleLayerIds) {
        if (map.getLayer(styleLayerId)) map.setFilter(styleLayerId, filter);
      }
    }
  }

  /**
   * Recolore les couches `fill` d'un binding. La coloration d'origine est mémorisée au premier
   * passage : elle est bakée dans map-style.json et doit pouvoir revenir telle quelle, sans
   * qu'on la recopie ici — deux exemplaires de la même règle divergeraient.
   */
  private applyTileFillColors(colors: Record<string, TileFillColor>): void {
    if (!this.map || !this.loaded) return;
    const map = this.map;
    for (const binding of this.tileLayers()) {
      const override = colors[binding.id] ?? null;
      for (const styleLayerId of binding.styleLayerIds) {
        const layer = map.getLayer(styleLayerId);
        if (!layer || layer.type !== 'fill') continue;
        if (!this.bakedFillColors.has(styleLayerId)) {
          this.bakedFillColors.set(styleLayerId, map.getPaintProperty(styleLayerId, 'fill-color'));
        }
        map.setPaintProperty(styleLayerId, 'fill-color', (override ?? this.bakedFillColors.get(styleLayerId)) as never);
      }
    }
  }

  private showPopup(lngLat: maplibregl.LngLatLike, label: string): void {
    this.popup?.remove();
    this.popup = new maplibregl.Popup({ closeButton: false, offset: 10 })
      .setLngLat(lngLat)
      .setText(label)
      .addTo(this.map!);
  }

  /** Recadre sur une emprise [minLng, minLat, maxLng, maxLat]. */
  private applyFitBbox(bbox: [number, number, number, number]): void {
    if (!this.map || !this.loaded) return;
    this.map.fitBounds(
      [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
      { padding: 48, maxZoom: 16, duration: 400 },
    );
  }

  private fitBounds(features: MapFeature[]): void {
    const bounds = new maplibregl.LngLatBounds();
    for (const f of features) this.extend(bounds, f);
    if (!bounds.isEmpty()) {
      this.map!.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
    }
  }

  private extend(bounds: maplibregl.LngLatBounds, f: MapFeature | undefined): void {
    const g = f?.geometry;
    if (!g) return;

    const ring = (r: unknown): void => {
      if (!Array.isArray(r)) return;
      for (const c of r) {
        if (Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
          bounds.extend([c[0], c[1]]);
        }
      }
    };

    if (g.type === 'Point') {
      const c = g.coordinates;
      if (Array.isArray(c) && c.length >= 2) bounds.extend([c[0], c[1]]);
    } else if (g.type === 'Polygon') {
      ring(g.coordinates?.[0]);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates ?? []) ring(poly?.[0]);
    }
  }
}
