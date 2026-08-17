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
import { MapFeature, MapLayerConfig } from './map.models';

const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const HIGHLIGHT = '#2563eb';
const NONE = '___none___';

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
  readonly center = input<[number, number]>([43.145, 11.595]);
  readonly zoom = input<number>(12);
  readonly fitToData = input<boolean>(true);
  readonly selectedId = input<string | null>(null);
  readonly showLayerControl = input<boolean>(true);

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
  private hasFit = false;
  private readonly isMockMode = this.config.get('useMockApi');

  protected readonly initError = signal(false);
  protected readonly panelOpen = signal(false);
  protected readonly visibility = signal<Record<string, boolean>>({});

  private readonly internalSelected = signal<string | null>(null);

  /** Éléments listés dans le panneau : overlays d'abord, puis groupes du fond cadastral. */
  protected readonly panelLayers = computed<PanelItem[]>(() => [
    ...this.layers().map((l) => ({ id: l.id, labelKey: l.labelKey })),
    ...this.basemapLayers().map((b) => ({ id: b.id, labelKey: b.labelKey })),
  ]);

  constructor() {
    // Init visibilité depuis la config des couches (overlay + fond cadastral)
    effect(() => {
      const map: Record<string, boolean> = {};
      for (const l of this.layers()) map[l.id] = l.visible;
      for (const b of this.basemapLayers()) map[b.id] = b.visible;
      this.visibility.set(map);
    });
    // Sync sélection contrôlée depuis le parent
    effect(() => { this.internalSelected.set(this.selectedId()); });
    // Re-rendu des données
    effect(() => { const f = this.features(); if (this.loaded) this.renderFeatures(f); });
    // Application de la visibilité
    effect(() => { const v = this.visibility(); if (this.loaded) this.applyVisibility(v); });
    // Application du highlight
    effect(() => { const sel = this.internalSelected(); if (this.loaded) this.applyHighlight(sel); });
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
      this.buildLayers();
      this.loaded = true;
      map.resize();
      this.renderFeatures(this.features());
      this.applyVisibility(this.visibility());
      this.applyHighlight(this.internalSelected());
    });
  }

  /** Crée une source (vide) + les couches de rendu et de highlight pour chaque couche déclarée. */
  private buildLayers(): void {
    const map = this.map!;
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

    const addLayerSafe = (config: maplibregl.LayerSpecification): void => {
      if (!map.getLayer(config.id)) map.addLayer(config);
    };

    for (const layer of this.layers()) {
      const src = `src-${layer.id}`;
      if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: empty });

      if (layer.type === 'fill') {
        addLayerSafe({ id: `${layer.id}-fill`, type: 'fill', source: src, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.45 } });
        addLayerSafe({ id: `${layer.id}-line`, type: 'line', source: src, paint: { 'line-color': ['get', 'color'], 'line-width': 1.4 } });
        addLayerSafe({ id: `${layer.id}-sel`, type: 'line', source: src, filter: ['==', ['get', 'id'], NONE], paint: { 'line-color': HIGHLIGHT, 'line-width': 3 } });
        this.wireInteractions(`${layer.id}-fill`);
      } else {
        addLayerSafe({ id: `${layer.id}-circle`, type: 'circle', source: src, paint: { 'circle-color': ['get', 'color'], 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
        addLayerSafe({ id: `${layer.id}-sel`, type: 'circle', source: src, filter: ['==', ['get', 'id'], NONE], paint: { 'circle-color': HIGHLIGHT, 'circle-opacity': 0.001, 'circle-radius': 8, 'circle-stroke-color': HIGHLIGHT, 'circle-stroke-width': 3 } });
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

  private renderFeatures(features: MapFeature[]): void {
    if (!this.map || !this.loaded) return;

    // Ne conserver que les features réellement géométriques.
    const withGeom = (features ?? []).filter((f): f is MapFeature => !!f && !!f.geometry);

    const byLayer = new Map<string, Feature[]>();
    for (const l of this.layers()) byLayer.set(l.id, []);

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

    if (this.fitToData() && !this.hasFit && withGeom.length > 0) this.fitBounds(withGeom);
  }

  private applyVisibility(vis: Record<string, boolean>): void {
    if (!this.map || !this.loaded) return;

    // Overlays GeoJSON
    for (const l of this.layers()) {
      const value = (vis[l.id] ?? true) ? 'visible' : 'none';
      const ids = l.type === 'fill' ? [`${l.id}-fill`, `${l.id}-line`, `${l.id}-sel`] : [`${l.id}-circle`, `${l.id}-sel`];
      for (const id of ids) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', value);
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

  private showPopup(lngLat: maplibregl.LngLatLike, label: string): void {
    this.popup?.remove();
    this.popup = new maplibregl.Popup({ closeButton: false, offset: 10 })
      .setLngLat(lngLat)
      .setText(label)
      .addTo(this.map!);
  }

  private fitBounds(features: MapFeature[]): void {
    const bounds = new maplibregl.LngLatBounds();
    for (const f of features) this.extend(bounds, f);
    if (!bounds.isEmpty()) {
      this.hasFit = true;
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
