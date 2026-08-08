import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { MapStyleService } from '../../../core/map/map-style.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import { GeoJSONPolygon } from '../../../core/models/das.models';

const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, TranslocoModule],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private facade = inject(BlocksFacade);
  private mapStyle = inject(MapStyleService);
  private config = inject(AppConfigService);
  private ngZone = inject(NgZone);

  protected readonly block$ = this.facade.selected$;
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly errorMessageKey$ = this.facade.detailErrorMessageKey$;

  protected readonly mapInitError = signal(false);
  private map?: maplibregl.Map;
  private readonly isMockMode = this.config.get('useMockApi');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.facade.loadDetail(id);

    // La carte ne peut être initialisée qu'une fois le conteneur du template
    // rendu ET la géométrie du bloc chargée — on attend les deux, une seule fois.
    let mapAlreadyInitialized = false;
    this.block$.subscribe((block) => {
      if (block && !mapAlreadyInitialized && this.mapContainer) {
        mapAlreadyInitialized = true;
        this.ngZone.runOutsideAngular(() => this.initMap(block.geomPolygon));
      }
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
    this.facade.clearDetail();
  }

  private initMap(geomPolygon: GeoJSONPolygon): void {
    if (!this.mapContainer) return;

    this.map = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isMockMode ? MOCK_BASEMAP_STYLE_URL : undefined, // en réel, le style est chargé juste après via MapStyleService
      center: [43.145, 11.595],
      zoom: 15,
    });

    this.map.on('error', (e) => {
      console.error('[block-detail] erreur MapLibre :', e.error);
      this.ngZone.run(() => this.mapInitError.set(true));
    });

    if (this.isMockMode) {
      this.map.on('load', () => this.addHighlightLayer(geomPolygon));
    } else {
      // En réel, on repart du style partagé (tuiles Martin) pour voir ce bloc
      // dans son contexte (rues, quartiers, blocs voisins), avec un contour
      // renforcé par-dessus pour le distinguer.
      this.mapStyle.getStyle().subscribe((style) => {
        this.map!.setStyle(style);
        this.map!.once('styledata', () => this.addHighlightLayer(geomPolygon));
      });
    }
  }

  private addHighlightLayer(geomPolygon: GeoJSONPolygon): void {
    if (!this.map) return;

    this.map.addSource('highlighted-block', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: geomPolygon },
    });

    this.map.addLayer({
      id: 'highlighted-block-fill',
      type: 'fill',
      source: 'highlighted-block',
      paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.35 },
    });

    this.map.addLayer({
      id: 'highlighted-block-outline',
      type: 'line',
      source: 'highlighted-block',
      paint: { 'line-color': '#1d4ed8', 'line-width': 3 },
    });

    const bounds = new maplibregl.LngLatBounds();
    (geomPolygon.coordinates[0] as [number, number][]).forEach((coord) => bounds.extend(coord));
    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
    }

    this.map.resize();
  }
}