import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { BlockListItem } from '../../../core/blocks/models/blocks.models';
import { BlocksFilters } from '../../../core/blocks/store/blocks.state';
import { BlockStatus } from '../../../core/models/das.models';
import { EMPTY_HIERARCHY_SELECTION, HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { HierarchyFacade } from '../../../core/hierarchy/store/hierarchy.facade';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { AppConfigService } from '../../../core/config/app-config.service';

const STATUS_COLORS: Record<BlockStatus, string> = {
  not_assigned: '#9aa3b5', assigned: '#2563eb', in_progress: '#d97706',
  submitted: '#7c3aed', approved: '#16a34a', needs_redo: '#dc2626',
};

/** Binding vers la couche tuile `blocs` du style de base (map-style.json). */
const BLOCS_TILE: TileLayerBinding = {
  id: 'blocs', labelKey: 'nav.blocks', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

@Component({
  selector: 'das-blocks-map',
  standalone: true,
  imports: [RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent, HierarchyCascadeComponent],
  templateUrl: './blocks-map.component.html',
  styleUrl: './blocks-map.component.scss',
})
export class BlocksMapComponent implements OnInit {
  private facade = inject(BlocksFacade);
  private hierarchy = inject(HierarchyFacade);
  private router = inject(Router);
  private readonly isMock = inject(AppConfigService).get('useMockApi');

  private readonly items = toSignal(this.facade.items$, { initialValue: [] as BlockListItem[] });
  private readonly filters = toSignal(this.facade.filters$, {
    initialValue: { search: '', status: null, ...EMPTY_HIERARCHY_SELECTION } as BlocksFilters,
  });

  /** Emprise du niveau hiérarchique sélectionné → recadrage carte. */
  protected readonly selectedBbox = this.hierarchy.selectedBbox;

  protected readonly legend: BlockStatus[] = [
    'approved', 'in_progress', 'submitted', 'assigned', 'not_assigned', 'needs_redo',
  ];

  /**
   * MODE MOCK : overlay GeoJSON local (les items portent `geom`).
   * MODE RÉEL : vide — la géométrie et la couleur (attribut `status`) viennent de la tuile.
   */
  protected readonly mapFeatures = computed<MapFeature[]>(() =>
    this.isMock
      ? this.items()
        .filter((b) => b.geom)
        .map((b) => ({ id: b.id, layerId: 'blocks', geometry: b.geom!, color: STATUS_COLORS[b.status], label: b.code }))
      : [],
  );

  /** Overlay déclaré uniquement en mock ; en réel, la tuile prend le relais. */
  protected readonly mapLayers: MapLayerConfig[] = this.isMock
    ? [{ id: 'blocks', labelKey: 'nav.blocks', type: 'fill', visible: true }]
    : [];

  protected readonly tileLayers: TileLayerBinding[] = this.isMock ? [] : [BLOCS_TILE];

  /** Adresses : couche du style de base, togglable (no-op silencieux en mock). */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    { id: 'adresses', labelKey: 'map.basemap.adresses', styleLayerIds: ['adresses-fill', 'adresses-line'], visible: false },
  ];
  onHierarchy(sel: HierarchySelection): void { this.facade.setFilters(sel); }
  /**
   * Filtre tuile dérivé de la sélection hiérarchie + statut. Le niveau non-null
   * le plus profond gagne (choisir un quartier implique sa zone/commune/ville).
   * En mock, `tileLayers` est vide → filtre inerte (la liste filtre côté store).
   */
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const f = this.filters();
    const clauses: ExpressionSpecification[] = [];
    if (f.blocId) clauses.push(['==', ['get', 'Id'], f.blocId] as ExpressionSpecification);
    else if (f.quartierId) clauses.push(['==', ['get', 'QuartierId'], f.quartierId] as ExpressionSpecification);
    else if (f.zoneId) clauses.push(['==', ['get', 'ZoneId'], f.zoneId] as ExpressionSpecification);
    else if (f.communeId) clauses.push(['==', ['get', 'CommuneId'], f.communeId] as ExpressionSpecification);
    else if (f.cityId) clauses.push(['==', ['get', 'CityId'], f.cityId] as ExpressionSpecification);
    if (f.status) clauses.push(['==', ['get', 'status'], f.status] as ExpressionSpecification);

    const expr: TileFilter =
      clauses.length === 0 ? null :
        clauses.length === 1 ? (clauses[0] as FilterSpecification) :
          (['all', ...clauses] as FilterSpecification);
    return { blocs: expr };
  });

  ngOnInit(): void { this.facade.load(); }

  onSelect(id: string): void { this.router.navigate(['/blocks', id]); }

  legendColor(status: BlockStatus): string { return STATUS_COLORS[status]; }
  statusLabelKey(status: BlockStatus): string { return `status.block.${status}`; }
}
