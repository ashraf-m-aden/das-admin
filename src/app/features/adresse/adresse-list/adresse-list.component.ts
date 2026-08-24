import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { AdresseFacade } from '../../../core/adresse/store/adresse.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig, TileFeatureStateMap, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { wktBounds } from '../../../core/ui/map/wkt.util';
import { MapLegendComponent, LegendEntry } from '../../../core/ui/map/map-legend/map-legend.component';
import { AddressDetailDrawerComponent } from '../address-detail-drawer/address-detail-drawer.component';
import { AddressDetail, AddressListItem, WORKFLOW_STAGES } from '../../../core/adresse/models/adresse.models';
import { initialAdresseFilters } from '../../../core/adresse/store/adresse.state';
import { AddressWorkflowStage } from '../../../core/models/das.models';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { HierarchyFacade } from '../../../core/hierarchy/store/hierarchy.facade';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { AppConfigService } from '../../../core/config/app-config.service';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

/** Bleu de surbrillance des résultats de recherche — override live, la coloration de base reste bakée dans le style. */
const SEARCH_HIT_COLOR = '#2563eb';

const ADRESSES_TILE: TileLayerBinding = {
  id: 'adresses', labelKey: 'adresse.layerParcels', source: 'adresses', sourceLayer: 'adresses_tiles',
  styleLayerIds: ['adresses-fill', 'adresses-line'], interactiveLayerId: 'adresses-fill', visible: true,
};

@Component({
  selector: 'das-adresse-list',
  standalone: true,
  imports: [
    AsyncPipe, ReactiveFormsModule, TranslocoModule, DasDatePipe, PageHeaderComponent,
    AddressDetailDrawerComponent, DasMapComponent, HierarchyCascadeComponent, MapLegendComponent,
  ],
  templateUrl: './adresse-list.component.html',
  styleUrl: './adresse-list.component.scss',
})
export class AdresseListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private facade = inject(AdresseFacade);
  private hierarchy = inject(HierarchyFacade);
  private route = inject(ActivatedRoute);
  private readonly isMock = inject(AppConfigService).get('useMockApi');

  protected readonly summary$ = this.facade.summary$;
  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as AddressListItem[] });
  protected readonly isLoading$ = this.facade.isListLoading$;
  protected readonly filterOptions$ = this.facade.filterOptions$;
  protected readonly pageInfo$ = this.facade.pageInfo$;
  protected readonly selectedIds = toSignal(this.facade.selectedIds$, { initialValue: [] as string[] });
  protected readonly selectedCount$ = this.facade.selectedCount$;
  protected readonly detailOpenId$ = this.facade.detailOpenId$;
  private readonly detail = toSignal(this.facade.detail$, { initialValue: null as AddressDetail | null });
  protected readonly isMutating$ = this.facade.isMutating$;

  private readonly filters = toSignal(this.facade.filters$, { initialValue: initialAdresseFilters });

  /** Emprise du niveau hiérarchique sélectionné → recadrage carte. */
  protected readonly selectedBbox = this.hierarchy.selectedBbox;

  protected readonly stages = WORKFLOW_STAGES;

  /** Entrées de légende (étape → couleur), dérivées de la palette unique STAGE_COLOR. */
  protected readonly legendEntries: LegendEntry[] =
    WORKFLOW_STAGES.map((stage) => ({ stage, color: STAGE_COLOR[stage] }));

  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.isMock
      ? this.items()
        .filter((a) => a.geom)
        .map((a) => ({ id: a.id, layerId: 'parcels', geometry: a.geom!, color: STAGE_COLOR[a.workflowStage], label: a.addressCode ?? a.libelle }))
      : [],
  );

  protected readonly mapLayers: MapLayerConfig[] = this.isMock
    ? [{ id: 'parcels', labelKey: 'adresse.layerParcels', type: 'fill', visible: true }]
    : [];

  protected readonly tileLayers: TileLayerBinding[] = this.isMock ? [] : [ADRESSES_TILE];

  protected readonly basemapLayers: BasemapLayerGroup[] = [
    { id: 'blocs', labelKey: 'nav.blocks', styleLayerIds: ['blocs-fill', 'blocs-line'], visible: false },
  ];

  /**
   * Filtre tuile ADRESSES : niveau hiérarchique non-null le plus profond + étape.
   * (search + équipe restent gérés côté liste ; pas d'attribut tuile correspondant.)
   * Les blocs sont un FOND de contexte non filtré → on ne produit qu'une clé `adresses`.
   * Attributs de la vue adresses_tiles en PascalCase (casse SQL exacte via Martin) ;
   * `workflowStage` est aliasé (dérivé du dernier Survey).
   */
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const f = this.filters();
    const clauses: ExpressionSpecification[] = [];
    if (f.blocId) clauses.push(['==', ['get', 'BlocId'], f.blocId] as ExpressionSpecification);
    // ⚠️ Exige un attribut `CloseId` sur la vue `adresses_tiles` (maintenue hors dépôt, côté Martin).
    // Tant qu'il n'y est pas, filtrer par close vide la carte — c'est VOULU : l'alternative serait
    // d'afficher tout le quartier pendant que la liste montre la close, soit exactement la
    // divergence liste↔carte que CLAUDE.md §4 interdit, et elle serait indébogable.
    else if (f.closeId) clauses.push(['==', ['get', 'CloseId'], f.closeId] as ExpressionSpecification);
    else if (f.quartierId) clauses.push(['==', ['get', 'QuartierId'], f.quartierId] as ExpressionSpecification);
    else if (f.zoneId) clauses.push(['==', ['get', 'ZoneId'], f.zoneId] as ExpressionSpecification);
    else if (f.communeId) clauses.push(['==', ['get', 'CommuneId'], f.communeId] as ExpressionSpecification);
    else if (f.cityId) clauses.push(['==', ['get', 'CityId'], f.cityId] as ExpressionSpecification);
    if (f.status) clauses.push(['==', ['get', 'workflowStage'], f.status] as ExpressionSpecification);

    const expr: TileFilter =
      clauses.length === 0 ? null :
        clauses.length === 1 ? (clauses[0] as FilterSpecification) :
          (['all', ...clauses] as FilterSpecification);
    return { adresses: expr };
  });

  /**
   * Surbrillance des résultats de recherche sur la carte.
   * `promoteId: "Id"` sur la source `adresses` fait que l'id de feature de tuile EST l'id
   * d'adresse : on peut donc colorier sans rien demander de plus au back. Ne s'active que si une
   * recherche texte est en cours — sinon toute la page serait bleue en permanence.
   */
  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const states: TileFeatureStateMap = {};
    if (this.filters().search.trim()) {
      for (const item of this.items()) states[item.id] = { colorOverride: SEARCH_HIT_COLOR };
    }
    const open = this.detail();
    if (open) states[open.id] = { colorOverride: SEARCH_HIT_COLOR, selected: true };
    return { adresses: states };
  });

  /**
   * Cadrage : l'adresse ouverte prime sur le niveau hiérarchique choisi.
   * `boundaryWkt` vient de `GET /api/adresses/{id}` — la liste, elle, renvoie toujours
   * `geom: null` à dessein, donc c'est la seule source de coordonnées disponible.
   */
  protected readonly mapFitBbox = computed(() => {
    const open = this.detail();
    if (open?.boundaryWkt) return wktBounds(open.boundaryWkt);
    return this.selectedBbox();
  });

  protected readonly filterForm = this.fb.group({
    search: [''],
    status: [null as AddressWorkflowStage | null],
    team: [null as string | null],
  });

  protected readonly allOnPageSelected = computed(() => {
    const ids = this.items().map((i) => i.id);
    const sel = this.selectedIds();
    return ids.length > 0 && ids.every((id) => sel.includes(id));
  });

  ngOnInit(): void {
    this.facade.init();
    const blocId = this.route.snapshot.queryParamMap.get('blocId');
    if (blocId) this.facade.setFilters({ blocId });
    const search = this.route.snapshot.queryParamMap.get('search');
    if (search) this.filterForm.patchValue({ search });
    this.filterForm.valueChanges.subscribe((v) => this.facade.setFilters({
      search: v.search ?? '', status: v.status ?? null, team: v.team ?? null,
    }));
  }

  /** Sélection de la cascade → filtres du registre (carte + liste). */
  onHierarchy(sel: HierarchySelection): void { this.facade.setFilters(sel); }

  isSelected(id: string): boolean { return this.selectedIds().includes(id); }
  toggle(id: string, ev: Event): void { ev.stopPropagation(); this.facade.toggleSelect(id); }
  toggleAll(): void { this.facade.toggleSelectAll(this.items().map((i) => i.id)); }

  open(id: string): void { this.facade.openDetail(id); }
  approveSelected(): void { this.facade.approveSelected(); }
  bulkPublish(): void { this.facade.bulkUpdate({ ids: this.selectedIds(), stage: 'Published' }); }
  clearSelection(): void { this.facade.clearSelection(); }

  goToPage(page: number): void { this.facade.setPage(page); }
  changePageSize(size: string): void { this.facade.setPageSize(Number(size)); }

  pagesAround(current: number, count: number): number[] {
    const start = Math.max(1, current - 1);
    const end = Math.min(count, start + 2);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
