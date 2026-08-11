import {
  Component, DestroyRef, ElementRef, NgZone, OnDestroy, OnInit,
  effect, inject, input, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { Feature, Geometry } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { AppConfigService } from '../../../core/config/app-config.service';
import { MapStyleService } from '../../../core/map/map-style.service';
import { BlockStatus, GeoJSONMultiPolygon } from '../../../core/models/das.models';

const STATUS_COLORS: Record<BlockStatus, string> = {
  not_assigned: '#9aa3b5', assigned: '#2563eb', in_progress: '#d97706',
  submitted: '#7c3aed', approved: '#16a34a', needs_redo: '#dc2626',
};
const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

@Component({
  selector: 'das-block-map',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './block-map.component.html',
  styleUrl: './block-map.component.scss',
})
export class BlockMapComponent implements OnInit, OnDestroy {
  readonly geometry = input<GeoJSONMultiPolygon | null>(null);
  readonly status = input<BlockStatus>('not_assigned');

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private readonly mapStyle = inject(MapStyleService);
  private readonly config = inject(AppConfigService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private loaded = false;
  private readonly isMockMode = this.config.get('useMockApi');

  protected readonly initError = signal(false);

  constructor() {
    effect(() => {
      const geom = this.geometry();
      this.status();
      if (this.map && this.loaded && geom) this.renderBlock();
    });
  }

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.isMockMode) {
        this.initMap(MOCK_BASEMAP_STYLE_URL);
      } else {
        this.mapStyle.getStyle().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((style) => this.initMap(style));
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.remove();
    this.map = undefined;
  }

  private initMap(style: maplibregl.StyleSpecification | string): void {
    const map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style, center: [43.145, 11.595], zoom: 13,
    });
    this.map = map;

    map.on('error', (e) => {
      console.error('[block-map] MapLibre error:', e.error);
      this.ngZone.run(() => this.initError.set(true));
    });

    this.resizeObserver = new ResizeObserver(() => {
      if (this.map && !this.initError()) this.map.resize();
    });
    this.resizeObserver.observe(this.mapContainer().nativeElement);

    map.on('load', () => {
      this.loaded = true;
      map.resize();
      if (this.geometry()) this.renderBlock();
    });
  }

  private renderBlock(): void {
    const geom = this.geometry();
    if (!this.map || !this.loaded || !geom || this.initError()) return;

    const feature: Feature = { type: 'Feature', properties: {}, geometry: geom as Geometry };
    const color = STATUS_COLORS[this.status()];

    const source = this.map.getSource('block') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(feature);
    } else {
      this.map.addSource('block', { type: 'geojson', data: feature });
      this.map.addLayer({ id: 'block-fill', type: 'fill', source: 'block', paint: { 'fill-color': color, 'fill-opacity': 0.4 } });
      this.map.addLayer({ id: 'block-outline', type: 'line', source: 'block', paint: { 'line-color': color, 'line-width': 2.5 } });
    }
    this.map.setPaintProperty('block-fill', 'fill-color', color);
    this.map.setPaintProperty('block-outline', 'line-color', color);

    this.fitToGeometry(geom);
  }

  private fitToGeometry(geom: GeoJSONMultiPolygon): void {
    const bounds = new maplibregl.LngLatBounds();
    for (const polygon of geom.coordinates) {
      for (const coord of polygon[0]) {
        bounds.extend(coord as [number, number]);
      }
    }
    if (!bounds.isEmpty()) {
      this.map!.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 0 });
    }
  }
}
