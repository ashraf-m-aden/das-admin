import { Component, OnDestroy, OnInit, computed, effect, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import type { FilterSpecification } from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { wktBounds } from '../../../core/ui/map/wkt.util';
import { UUID } from '../../../core/models/das.models';
import { NotSurveyableReason } from '../../../core/review/models/review.models';
import {
  STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, POI_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
} from '../../../core/ui/map/basemap-groups';

const BLOC_TILE: TileLayerBinding = {
  id: 'bloc', labelKey: 'nav.blocks', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

@Component({
  selector: 'das-block-detail',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './block-detail.component.html',
  styleUrl: './block-detail.component.scss',
})
export class BlockDetailComponent implements OnInit, OnDestroy {

  /**
   * Voirie et contours du style de base, pilotables depuis le panneau des couches. Le panneau
   * a été activé sur cette carte le 2026-08-25 : depuis le retrait du fond CARTO, la voirie est
   * la seule référence de terrain, et il faut pouvoir la masquer pour lire les contours dessous.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, POI_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
  ];
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected facade = inject(BlocksFacade);
  protected reviewFacade = inject(ReviewFacade);

  private readonly blockId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly block = toSignal(this.facade.selected$);
  protected readonly isLoading$ = this.facade.isDetailLoading$;
  protected readonly isUpdating$ = this.facade.isUpdating$;
  protected readonly updateErrorMessageKey$ = this.facade.updateErrorMessageKey$;

  protected readonly tileLayers: TileLayerBinding[] = [BLOC_TILE];
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const id = this.block()?.id ?? '___none___';
    return { bloc: ['==', ['get', 'Id'], id] as FilterSpecification };
  });
  protected readonly fitBbox = computed(() => {
    const wkt = this.block()?.boundaryWkt;
    return wkt ? wktBounds(wkt) : null;
  });

  protected readonly nameForm = this.fb.nonNullable.group({
    name: ['', [Validators.minLength(2)]],
  });

  protected readonly currentSurveys = toSignal(this.reviewFacade.currentSurveys$, { initialValue: [] });
  protected readonly isCurrentSurveysLoading$ = this.reviewFacade.isCurrentSurveysLoading$;

  private readonly etatOccupationMap = toSignal(
    this.reviewFacade.etatOccupationOptions$.pipe(map((options) => new Map(options.map((o) => [o.id, o.nom])))),
    { initialValue: new Map<UUID, string>() },
  );

  protected readonly surveyedCount = computed(() => this.currentSurveys().filter((s) => s.outcome === 'Surveyed').length);
  protected readonly notSurveyableCount = computed(() => this.currentSurveys().length - this.surveyedCount());

  /** Répartition des parcelles relevées par état du bâti (`etatOccupationId`) — vide tant que non chargé. */
  protected readonly byEtatOccupation = computed(() => {
    const labels = this.etatOccupationMap();
    const counts = new Map<string, number>();
    for (const s of this.currentSurveys()) {
      if (s.outcome !== 'Surveyed' || !s.etatOccupationId) continue;
      const label = labels.get(s.etatOccupationId) ?? s.etatOccupationId;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  });

  /** Répartition des parcelles non relevables par motif. */
  protected readonly byNotSurveyableReason = computed(() => {
    const counts = new Map<NotSurveyableReason, number>();
    for (const s of this.currentSurveys()) {
      if (s.outcome !== 'NotSurveyable' || !s.notSurveyableReason) continue;
      counts.set(s.notSurveyableReason, (counts.get(s.notSurveyableReason) ?? 0) + 1);
    }
    return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
  });

  constructor() {
    effect(() => {
      const b = this.block();
      if (b) this.nameForm.patchValue({ name: b.name ?? '' }, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.facade.loadDetail(this.blockId);
    this.reviewFacade.loadCurrentSurveys(this.blockId, false);
  }

  notSurveyableReasonKey(reason: NotSurveyableReason): string {
    return `verification.notSurveyableReason.${reason.toLowerCase()}`;
  }

  ngOnDestroy(): void {
    this.facade.clearDetail();
  }

  saveName(): void {
    const b = this.block();
    if (!b || this.nameForm.invalid) { this.nameForm.markAllAsTouched(); return; }
    const name = this.nameForm.getRawValue().name.trim();
    if (b.number === null) return; // garde-fou : le back exige Number > 0, un bloc sans numéro ne peut pas être renommé via ce endpoint.
    this.facade.update(b.id, { code: b.code, name: name || null, number: b.number, boundaryWkt: b.boundaryWkt });
  }
}
