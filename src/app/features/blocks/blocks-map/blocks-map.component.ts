import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig, TileFillColor, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { HierarchyFacade } from '../../../core/hierarchy/store/hierarchy.facade';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import {
  STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
} from '../../../core/ui/map/basemap-groups';

/**
 * Statut affiché = uniquement celui de la tuile `blocs_tiles` (agrégat live sur
 * `CampaignAssignments`, calculé côté vue SQL) — jamais un champ de `Block`, qui n'en a pas.
 * Ces 4 valeurs sont les seules que la vue peut produire.
 */
type BlocTileStatus = 'not_assigned' | 'assigned' | 'in_progress' | 'submitted';
/** Palette de mise en évidence par zone — distincte des couleurs de STATUT, qu'elle remplace le temps du surlignage. */
const ZONE_PALETTE = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0d9488'];
/** Blocs hors zones surlignées : atténués, pas masqués — le contexte reste lisible. */
const ZONE_DIMMED = '#dfe3ea';

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

  /** Zones à mettre en évidence — surligner n'est pas filtrer : les autres blocs restent visibles. */
  protected readonly highlightedZones = signal<string[]>([]);

  onZoneHighlight(zoneIds: string[]): void { this.highlightedZones.set(zoneIds); }

  /**
   * Recoloration lue sur l'attribut `ZoneId` que la tuile porte DÉJÀ — pas de `feature-state`,
   * qui aurait exigé une correspondance bloc → zone que l'API REST ne donne pas (`Block` n'a que
   * `quartierId`). Les blocs hors sélection gardent leur couleur de statut, en gris atténué,
   * pour que la mise en évidence se lise par contraste sans faire disparaître le contexte.
   */
  protected readonly tileFillColors = computed<Record<string, TileFillColor>>(() => {
    const zones = this.highlightedZones();
    if (zones.length === 0) return { blocs: null };
    const matches = zones.flatMap((z, i) => [z, ZONE_PALETTE[i % ZONE_PALETTE.length]]);
    return {
      // Le tuple `match` est construit dynamiquement : TypeScript ne peut pas en vérifier
      // l'arité, d'où le passage par `unknown`. La forme reste celle de la spec MapLibre.
      blocs: ['match', ['get', 'ZoneId'], ...matches, ZONE_DIMMED] as unknown as ExpressionSpecification,
    };
  });

  zoneColor(index: number): string { return ZONE_PALETTE[index % ZONE_PALETTE.length]; }

  /** Pas d'overlay GeoJSON pour ce module : la géométrie vient toujours des tuiles Martin. */
  protected readonly mapFeatures = computed<MapFeature[]>(() => []);
  protected readonly mapLayers: MapLayerConfig[] = [];
  protected readonly tileLayers: TileLayerBinding[] = [BLOCS_TILE];

  /** Voirie + parcelles : couches du style de base, togglables (no-op silencieux en mock). */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
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
