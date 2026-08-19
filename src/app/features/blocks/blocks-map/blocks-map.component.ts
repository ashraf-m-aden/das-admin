import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { HierarchyFacade } from '../../../core/hierarchy/store/hierarchy.facade';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';

/**
 * Statut affiché = uniquement celui de la tuile `blocs_tiles` (agrégat live sur
 * `CampaignAssignments`, calculé côté vue SQL) — jamais un champ de `Block`, qui n'en a pas.
 * Ces 4 valeurs sont les seules que la vue peut produire.
 */
type BlocTileStatus = 'not_assigned' | 'assigned' | 'in_progress' | 'submitted';
const STATUS_COLORS: Record<BlocTileStatus, string> = {
  not_assigned: '#9aa3b5', assigned: '#2563eb', in_progress: '#d97706', submitted: '#7c3aed',
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

  /** Emprise du niveau hiérarchique sélectionné → recadrage carte. */
  protected readonly selectedBbox = this.hierarchy.selectedBbox;

  protected readonly legend: BlocTileStatus[] = ['not_assigned', 'assigned', 'in_progress', 'submitted'];
  protected readonly statusFilter = signal<BlocTileStatus | null>(null);

  /** Pas d'overlay GeoJSON pour ce module : la géométrie vient toujours des tuiles Martin. */
  protected readonly mapFeatures = computed<MapFeature[]>(() => []);
  protected readonly mapLayers: MapLayerConfig[] = [];
  protected readonly tileLayers: TileLayerBinding[] = [BLOCS_TILE];

  /** Adresses : couche du style de base, togglable (no-op silencieux en mock). */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    { id: 'adresses', labelKey: 'map.basemap.adresses', styleLayerIds: ['adresses-fill', 'adresses-line'], visible: false },
  ];

  onHierarchy(sel: HierarchySelection): void { this.facade.setFilters(sel); }

  /**
   * Filtre tuile : hiérarchie (le niveau non-null le plus profond gagne) + statut, tous deux
   * lus sur les attributs natifs de la tuile — aucun des deux ne passe par l'API REST.
   */
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const f = this.hierarchy.selection();
    const clauses: ExpressionSpecification[] = [];
    if (f.quartierId) clauses.push(['==', ['get', 'QuartierId'], f.quartierId] as ExpressionSpecification);
    else if (f.zoneId) clauses.push(['==', ['get', 'ZoneId'], f.zoneId] as ExpressionSpecification);
    else if (f.communeId) clauses.push(['==', ['get', 'CommuneId'], f.communeId] as ExpressionSpecification);
    else if (f.cityId) clauses.push(['==', ['get', 'CityId'], f.cityId] as ExpressionSpecification);
    if (this.statusFilter()) clauses.push(['==', ['get', 'status'], this.statusFilter()] as ExpressionSpecification);

    const expr: TileFilter =
      clauses.length === 0 ? null :
        clauses.length === 1 ? (clauses[0] as FilterSpecification) :
          (['all', ...clauses] as FilterSpecification);
    return { blocs: expr };
  });

  ngOnInit(): void { this.facade.load(); }

  onSelect(id: string): void { this.router.navigate(['/blocks', id]); }
  filterStatus(status: BlocTileStatus | null): void { this.statusFilter.set(status); }

  legendColor(status: BlocTileStatus): string { return STATUS_COLORS[status]; }
  statusLabelKey(status: BlocTileStatus): string { return `status.block.${status}`; }
}
