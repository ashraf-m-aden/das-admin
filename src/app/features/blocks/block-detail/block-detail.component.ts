import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import * as maplibregl from 'maplibre-gl';
import { AppConfigService } from '../../../core/config/app-config.service';
import { MapStyleService } from '../../../core/map/map-style.service';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { GeoJSONPolygon } from '../../../core/models/das.models';

const MOCK_BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

type NameForm = FormGroup<{ name: FormControl<string> }>;

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, ReactiveFormsModule, TranslocoModule],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {
  // viewChild sous forme de signal : réactif dès que l'élément entre dans le DOM
  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(BlocksFacade);
  private readonly mapStyle = inject(MapStyleService);
  private readonly config = inject(AppConfigService);
  private readonly ngZone = inject(NgZone);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly block$ = this.facade.selected$;
  // Conversion du block$ en signal pour une intégration fluide avec l'effect
  protected readonly blockSignal = toSignal(this.block$);

  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly errorMessageKey$ = this.facade.detailErrorMessageKey$;
  protected readonly isSavingName$ = this.facade.isSavingName$;
  protected readonly nameErrorMessageKey$ = this.facade.nameErrorMessageKey$;

  protected readonly isEditingName = signal(false);
  protected readonly nameForm: NameForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  protected readonly mapInitError = signal(false);
  private map?: maplibregl.Map;
  private resizeObserver?: ResizeObserver;
  private readonly isMockMode = this.config.get('useMockApi');
  private mapAlreadyInitialized = false;

  constructor() {
    // Un effect surveille automatiquement quand le container DOM ET les données du bloc sont prêts
    effect(() => {
      const container = this.mapContainer();
      const block = this.blockSignal();

      if (container && block?.geomPolygon && !this.mapAlreadyInitialized) {
        this.mapAlreadyInitialized = true;
        this.ngZone.runOutsideAngular(() => {
          this.initMap(container.nativeElement, block.geomPolygon);
        });
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.facade.loadDetail(id);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.map?.remove();
    this.map = undefined;
    this.facade.clearDetail();
  }

  startEditName(currentName: string | null): void {
    this.nameForm.setValue({ name: currentName ?? '' });
    this.isEditingName.set(true);
  }

  cancelEditName(): void {
    this.isEditingName.set(false);
  }

  confirmName(id: string): void {
    if (this.nameForm.invalid) {
      this.nameForm.markAllAsTouched();
      return;
    }
    this.facade.setName(id, this.nameForm.getRawValue().name);
    this.isEditingName.set(false);
  }

  private observeContainerResize(container: HTMLDivElement): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.map && !this.mapInitError()) {
        this.map.resize();
      }
    });
    this.resizeObserver.observe(container);
  }

  private initMap(container: HTMLDivElement, geomPolygon: GeoJSONPolygon): void {
    if (this.isMockMode) {
      const map = new maplibregl.Map({
        container,
        style: MOCK_BASEMAP_STYLE_URL,
        center: [43.145, 11.595],
        zoom: 15,
      });

      this.setupMapEvents(map, container, geomPolygon);
    } else {
      this.mapStyle
        .getStyle()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((style) => {
          const map = new maplibregl.Map({
            container,
            style,
            center: [43.145, 11.595],
            zoom: 15,
          });

          this.setupMapEvents(map, container, geomPolygon);
        });
    }
  }

  private setupMapEvents(map: maplibregl.Map, container: HTMLDivElement, geomPolygon: GeoJSONPolygon): void {
    this.map = map;

    map.on('error', (e) => {
      console.error('[block-detail] Erreur MapLibre :', e.error);
      this.ngZone.run(() => this.mapInitError.set(true));
    });

    map.on('load', () => {
      this.addHighlightLayer(map, geomPolygon);
      this.observeContainerResize(container);
    });
  }

  private addHighlightLayer(map: maplibregl.Map, geomPolygon: GeoJSONPolygon): void {
    map.addSource('highlighted-block', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: geomPolygon },
    });

    map.addLayer({
      id: 'highlighted-block-fill',
      type: 'fill',
      source: 'highlighted-block',
      paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.35 },
    });

    map.addLayer({
      id: 'highlighted-block-outline',
      type: 'line',
      source: 'highlighted-block',
      paint: { 'line-color': '#1d4ed8', 'line-width': 3 },
    });

    const bounds = new maplibregl.LngLatBounds();
    if (geomPolygon.coordinates && geomPolygon.coordinates[0]) {
      (geomPolygon.coordinates[0] as [number, number][]).forEach((coord) => bounds.extend(coord));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 17 });
      }
    }

    map.resize();
  }
}
