import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { MapStyleService } from '../../../core/map/map-style.service';
import { AppConfigService } from '../../../core/config/app-config.service';

const STATUS_COLORS: Record<string, string> = {
  not_assigned: '#6b7280',
  assigned: '#2563eb',
  in_progress: '#d97706',
  submitted: '#7c3aed',
  approved: '#16a34a',
  needs_redo: '#dc2626',
};

@Component({
  selector: 'das-blocks-map',
  standalone: true,
  templateUrl: './blocks-map.component.html',
  styleUrl: './blocks-map.component.scss',
})
export class BlocksMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private mapContainer!: ElementRef<HTMLDivElement>;

  private facade = inject(BlocksFacade);
  private mapStyle = inject(MapStyleService);
  private config = inject(AppConfigService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly isMockMode = this.config.get('useMockApi');

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
    this.map?.remove();
  }

  private observeContainerResize(): void {
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private initMockOverlayMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f9fafb' } }],
      },
      center: [43.145, 11.595], // Djibouti-ville
      zoom: 12,
    });

    this.observeContainerResize();

    this.map.on('load', () => {
      this.map?.resize();
      this.map?.triggerRepaint();

      this.facade.blocksGeoJson$.subscribe((geojson) => {
        this.upsertMockLayer(geojson as FeatureCollection);
      });
    });
  }

  private upsertMockLayer(geojson: FeatureCollection): void {
    if (!this.map) return;
    const source = this.map.getSource('mock-blocks') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson);
      this.map.triggerRepaint();
      return;
    }

    this.map.addSource('mock-blocks', { type: 'geojson', data: geojson });

    this.map.addLayer({
      id: 'mock-blocks-fill',
      type: 'fill',
      source: 'mock-blocks',
      paint: {
        'fill-color': [
          'match',
          ['get', 'status'],
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

    this.map.addLayer({
      id: 'mock-blocks-outline',
      type: 'line',
      source: 'mock-blocks',
      paint: { 'line-color': '#1f2937', 'line-width': 1 },
    });

    this.map.on('click', 'mock-blocks-fill', (e) => {
      const id = e.features?.[0]?.properties?.['id'];
      if (id) {
        this.ngZone.run(() => this.router.navigate(['/blocks', id]));
      }
    });

    this.map.on('mouseenter', 'mock-blocks-fill', () => {
      this.map!.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'mock-blocks-fill', () => {
      this.map!.getCanvas().style.cursor = '';
    });

    const bounds = new maplibregl.LngLatBounds();
    geojson.features.forEach((f) => {
      if (f.geometry.type === 'Polygon') {
        (f.geometry.coordinates[0] as [number, number][]).forEach((coord) => bounds.extend(coord));
      }
    });
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }

    this.map.triggerRepaint();
  }

  private initRealTileMap(): void {
    this.mapStyle.getStyle().subscribe((style) => {
      this.map = new maplibregl.Map({
        container: this.mapContainer.nativeElement,
        style,
        center: [43.145, 11.595],
        zoom: 12,
      });

      this.observeContainerResize();

      this.map.on('load', () => {
        this.map?.resize();
        this.map?.triggerRepaint();
      });

      this.map.on('click', 'blocks-fill', (e) => {
        const id = e.features?.[0]?.properties?.['id'];
        if (id) {
          this.ngZone.run(() => this.router.navigate(['/blocks', id]));
        }
      });

      this.map.on('mouseenter', 'blocks-fill', () => {
        this.map!.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'blocks-fill', () => {
        this.map!.getCanvas().style.cursor = '';
      });
    });
  }
}
