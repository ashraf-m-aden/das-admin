import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import type { FeatureCollection, Geometry } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { AppConfigService } from '../../../core/config/app-config.service';
import { MapStyleService } from '../../../core/map/map-style.service';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BlockStatus } from '../../../core/models/das.models';

const STATUS_COLORS: Record<BlockStatus, string> = {
  not_assigned: '#9aa3b5',
  assigned: '#2563eb',
  in_progress: '#d97706',
  submitted: '#7c3aed',
  approved: '#16a34a',
  needs_redo: '#dc2626',
};

const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

@Component({
  selector: 'das-blocks-map',
  standalone: true,
  imports: [RouterLink, TranslocoModule, PageHeaderComponent],
  templateUrl: './blocks-map.component.html',
  styleUrl: './blocks-map.component.scss',
})
export class BlocksMapComponent implements OnInit, OnDestroy {
  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private readonly facade = inject(BlocksFacade);
  private readonly mapStyle = inject(MapStyleService);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly isMockMode = this.config.get('useMockApi');
  private hasFitBoundsOnce = false;

  protected readonly initError = signal(false);
  protected readonly ready = signal(false);

  protected readonly legend: BlockStatus[] = [
    'approved', 'in_progress', 'submitted', 'assigned', 'not_assigned', 'needs_redo',
  ];

  ngOnInit(): void {
    this.facade.load();

    this.ngZone.runOutsideAngular(() => {
      if (this.isMockMode) {
        this.initMockOverlayMap();
      } else {
        this.initRealTileMap();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.remove();
    this.map = undefined;
  }

  legendColor(status: BlockStatus): string {
    return STATUS_COLORS[status];
  }

  statusLabelKey(status: BlockStatus): string {
    return `status.block.${status}`;
  }

  private get isMapUsable(): boolean {
    return !!this.map && !this.initError();
  }

  private observeContainerResize(): void {
    const container = this.mapContainer().nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isMapUsable) this.map?.resize();
    });
    this.resizeObserver.observe(container);
  }

  private initMockOverlayMap(): void {
    this.map = this.createMapInstance(MOCK_BASEMAP_STYLE_URL);
    this.observeContainerResize();

    this.map.on('load', () => {
      if (!this.isMapUsable) return;
      this.ngZone.run(() => this.ready.set(true));
      this.map?.resize();

      this.facade.blocksGeoJson$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((geojson) => this.upsertMockLayer(geojson as FeatureCollection));
    });
  }

  private initRealTileMap(): void {
    this.mapStyle
      .getStyle()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((style) => {
        const map = this.createMapInstance(style);
        this.map = map;
        this.observeContainerResize();

        map.on('load', () => {
          if (!this.isMapUsable) return;
          this.ngZone.run(() => this.ready.set(true));
          map.resize();

          map.on('click', 'blocks-fill', (e) => {
            const id = e.features?.[0]?.properties?.['id'];
            if (id) this.ngZone.run(() => this.router.navigate(['/blocks', id]));
          });
          map.on('mouseenter', 'blocks-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', 'blocks-fill', () => { map.getCanvas().style.cursor = ''; });
        });
      });
  }

  private createMapInstance(style: maplibregl.StyleSpecification | string): maplibregl.Map {
    const map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style,
      center: [43.145, 11.595],
      zoom: 12,
    });

    map.on('error', (e) => {
      console.error('[blocks-map] MapLibre error:', e.error);
      this.ngZone.run(() => this.initError.set(true));
    });

    return map;
  }

  private upsertMockLayer(geojson: FeatureCollection): void {
    if (!this.isMapUsable) return;
    const source = this.map!.getSource('mock-blocks') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson);
    } else {
      this.map!.addSource('mock-blocks', { type: 'geojson', data: geojson });

      this.map!.addLayer({
        id: 'mock-blocks-fill',
        type: 'fill',
        source: 'mock-blocks',
        paint: {
          'fill-color': [
            'match', ['get', 'status'],
            'not_assigned', STATUS_COLORS['not_assigned'],
            'assigned', STATUS_COLORS['assigned'],
            'in_progress', STATUS_COLORS['in_progress'],
            'submitted', STATUS_COLORS['submitted'],
            'approved', STATUS_COLORS['approved'],
            'needs_redo', STATUS_COLORS['needs_redo'],
            '#9ca3af',
          ],
          'fill-opacity': 0.55,
        },
      });

      this.map!.addLayer({
        id: 'mock-blocks-outline',
        type: 'line',
        source: 'mock-blocks',
        paint: { 'line-color': '#1f2937', 'line-width': 1.5 },
      });

      this.map!.on('click', 'mock-blocks-fill', (e) => {
        const id = e.features?.[0]?.properties?.['id'];
        if (id) this.ngZone.run(() => this.router.navigate(['/blocks', id]));
      });
      this.map!.on('mouseenter', 'mock-blocks-fill', () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map!.on('mouseleave', 'mock-blocks-fill', () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
    }

    if (!this.hasFitBoundsOnce && geojson.features.length > 0) {
      this.fitMapToBounds(geojson);
    }
  }

  private fitMapToBounds(geojson: FeatureCollection): void {
    const bounds = new maplibregl.LngLatBounds();
    geojson.features.forEach((f) => this.extendBoundsFromGeometry(bounds, f.geometry));
    if (!bounds.isEmpty()) {
      this.hasFitBoundsOnce = true;
      this.map!.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }

  private extendBoundsFromGeometry(bounds: maplibregl.LngLatBounds, geometry: Geometry): void {
    if (geometry.type === 'Polygon') {
      geometry.coordinates[0].forEach((coord) => bounds.extend(coord as [number, number]));
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((poly) => poly[0].forEach((coord) => bounds.extend(coord as [number, number])));
    }
  }
}
