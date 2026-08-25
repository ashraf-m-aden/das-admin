import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { FieldOpsFacade } from '../../../core/fieldops/store/fieldops.facade';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { TileFeatureStateMap, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { unionBounds, wktBounds } from '../../../core/ui/map/wkt.util';
import { AssignmentStatus, CampaignBloc, UUID } from '../../../core/models/das.models';
import { StaffMember } from '../../../core/staff/models/staff.models';
import { STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP } from '../../../core/ui/map/basemap-groups';

/** Palette distincte et stable par agent — même génération de couleur que dans le template (agentColor). */
const AGENT_PALETTE = ['#2563eb', '#d97706', '#16a34a', '#7c3aed', '#dc2626', '#0d9488', '#db2777', '#65a30d'];

const CAMPAIGN_BLOCS_TILE: TileLayerBinding = {
  id: 'campaign-blocs', labelKey: 'fieldops.mapLayer', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AGENT_PALETTE[h % AGENT_PALETTE.length];
}

@Component({
  selector: 'das-campaign-detail',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasDatePipe, PageHeaderComponent, HierarchyCascadeComponent, DasMapComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss',
})
export class CampaignDetailComponent implements OnInit, OnDestroy {

  /**
   * Voirie et contours du style de base, pilotables depuis le panneau des couches. Le panneau
   * a été activé sur cette carte le 2026-08-25 : depuis le retrait du fond CARTO, la voirie est
   * la seule référence de terrain, et il faut pouvoir la masquer pour lire les contours dessous.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP];
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected facade = inject(FieldOpsFacade);
  private staffFacade = inject(StaffFacade);
  protected blocksFacade = inject(BlocksFacade);

  private readonly campaignId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly campaign = toSignal(this.facade.selectedCampaign$);
  protected readonly progress = toSignal(this.facade.progress$);
  protected readonly campaignBlocs = toSignal(this.facade.campaignBlocs$, { initialValue: [] as CampaignBloc[] });
  protected readonly assignments = toSignal(this.facade.assignments$, { initialValue: [] });

  private readonly staff = toSignal(this.staffFacade.items$, { initialValue: [] as StaffMember[] });
  protected readonly agents = computed(() => this.staff().filter((s) => s.isActive && s.roles.includes('AgentTerrain')));

  protected readonly blocks = toSignal(this.blocksFacade.items$, { initialValue: [] });
  protected readonly selectedBlocIds = signal<Set<UUID>>(new Set());
  protected readonly assignedBlocIds = computed(() => new Set(this.campaignBlocs().map((cb) => cb.blocId)));

  protected readonly assignmentStatuses: AssignmentStatus[] = ['ToDo', 'Done', 'Abandoned'];

  protected readonly reassigningBlocId = signal<UUID | null>(null);
  protected readonly abandoningId = signal<UUID | null>(null);
  protected readonly editingCampaign = signal(false);

  protected readonly assignBlocForm = this.fb.nonNullable.group({ agentId: ['', [Validators.required]] });
  protected readonly reassignBlocForm = this.fb.nonNullable.group({ agentId: ['', [Validators.required]] });
  protected readonly abandonForm = this.fb.nonNullable.group({ reason: ['', [Validators.required]] });
  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    deadline: ['', [Validators.required]],
  });

  protected readonly transferForm = this.fb.nonNullable.group({
    fromAgentId: ['', [Validators.required]],
    toAgentId: ['', [Validators.required]],
    thisCampaignOnly: [true],
  });

  // ---- Carte : blocs de la campagne, colorés par agent titulaire --------------

  protected readonly mapAgentFilter = signal<UUID | null>(null);
  protected readonly mapAgents = computed(() => {
    const seen = new Map<UUID, string>();
    for (const cb of this.campaignBlocs()) seen.set(cb.agentId, cb.agentFullName);
    return [...seen.entries()].map(([id, name]) => ({ id, name, color: hashColor(id) }));
  });

  protected readonly tileLayers: TileLayerBinding[] = [CAMPAIGN_BLOCS_TILE];

  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const states: TileFeatureStateMap = {};
    for (const cb of this.campaignBlocs()) states[cb.blocId] = { colorOverride: hashColor(cb.agentId) };
    return { 'campaign-blocs': states };
  });

  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const ids = this.campaignBlocs()
      .filter((cb) => !this.mapAgentFilter() || cb.agentId === this.mapAgentFilter())
      .map((cb) => cb.blocId);
    const clause: ExpressionSpecification = ['in', ['get', 'Id'], ['literal', ids]];
    return { 'campaign-blocs': (ids.length ? clause : ['==', ['get', 'Id'], '___none___']) as FilterSpecification };
  });

  /** WKT par blocId, chargé dès que la liste des blocs de la campagne change — sert uniquement à cadrer la carte. */
  private readonly blocBoundaries = signal<Record<UUID, string>>({});

  /** Emprise de tous les blocs de la campagne — cadrage par défaut à l'entrée sur l'écran. */
  protected readonly campaignBbox = computed(() =>
    unionBounds(this.campaignBlocs().map((cb) => {
      const wkt = this.blocBoundaries()[cb.blocId];
      return wkt ? wktBounds(wkt) : null;
    })),
  );

  /** Emprise des blocs de l'agent filtré, sinon celle de toute la campagne. */
  protected readonly mapFitBbox = computed(() => {
    const filter = this.mapAgentFilter();
    if (!filter) return this.campaignBbox();
    return unionBounds(
      this.campaignBlocs()
        .filter((cb) => cb.agentId === filter)
        .map((cb) => {
          const wkt = this.blocBoundaries()[cb.blocId];
          return wkt ? wktBounds(wkt) : null;
        }),
    );
  });

  agentColor(agentId: string): string { return hashColor(agentId); }
  filterMapAgent(agentId: UUID | null): void { this.mapAgentFilter.set(agentId); }

  constructor() {
    effect(() => {
      const ids = this.campaignBlocs().map((cb) => cb.blocId);
      if (!ids.length) { this.blocBoundaries.set({}); return; }
      this.facade.getBlocBoundaries(ids).subscribe((boundaries) => this.blocBoundaries.set(boundaries));
    });
  }

  ngOnInit(): void {
    this.facade.loadCampaignDetail(this.campaignId);
    this.facade.loadCampaignProgress(this.campaignId);
    this.facade.loadCampaignBlocs(this.campaignId);
    this.facade.setAssignmentFilters({ campaignId: this.campaignId, agentId: null, status: null });
    this.staffFacade.load();
  }

  ngOnDestroy(): void {
    this.facade.clearSelectedCampaign();
  }

  startEditCampaign(): void {
    const c = this.campaign();
    if (!c) return;
    this.editForm.reset({ name: c.name, deadline: c.deadline });
    this.editingCampaign.set(true);
  }
  cancelEditCampaign(): void { this.editingCampaign.set(false); }
  confirmEditCampaign(): void {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    this.facade.updateCampaign(this.campaignId, this.editForm.getRawValue());
    this.editingCampaign.set(false);
  }

  onHierarchy(sel: HierarchySelection): void {
    this.selectedBlocIds.set(new Set());
    this.blocksFacade.setFilters(sel);
    this.blocksFacade.load();
  }

  toggleBloc(id: UUID): void {
    this.selectedBlocIds.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  submitAssignBlocs(): void {
    if (this.assignBlocForm.invalid || this.selectedBlocIds().size === 0) { this.assignBlocForm.markAllAsTouched(); return; }
    const agentId = this.assignBlocForm.getRawValue().agentId;
    for (const blocId of this.selectedBlocIds()) this.facade.assignBloc(this.campaignId, blocId, agentId);
    this.selectedBlocIds.set(new Set());
  }

  startReassignBloc(blocId: UUID): void {
    this.reassignBlocForm.reset({ agentId: '' });
    this.reassigningBlocId.set(blocId);
  }
  cancelReassignBloc(): void { this.reassigningBlocId.set(null); }
  confirmReassignBloc(blocId: UUID): void {
    if (this.reassignBlocForm.invalid) { this.reassignBlocForm.markAllAsTouched(); return; }
    this.facade.reassignBloc(this.campaignId, blocId, this.reassignBlocForm.getRawValue().agentId);
    this.reassigningBlocId.set(null);
  }

  startCampaign(): void { this.facade.startCampaign(this.campaignId); }
  populateCampaign(): void { this.facade.populateCampaign(this.campaignId); }
  extendCampaign(): void { this.facade.extendCampaign(this.campaignId); }
  closeCampaign(): void { this.facade.closeCampaign(this.campaignId); }

  filterAssignmentStatus(status: AssignmentStatus | null): void {
    this.facade.setAssignmentFilters({ status });
  }

  startAbandon(id: UUID): void {
    this.abandonForm.reset({ reason: '' });
    this.abandoningId.set(id);
  }
  cancelAbandon(): void { this.abandoningId.set(null); }
  confirmAbandon(id: UUID): void {
    if (this.abandonForm.invalid) { this.abandonForm.markAllAsTouched(); return; }
    this.facade.abandonAssignment(id, this.abandonForm.getRawValue().reason);
    this.abandoningId.set(null);
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) { this.transferForm.markAllAsTouched(); return; }
    const v = this.transferForm.getRawValue();
    this.facade.transferBlocs(v.fromAgentId, v.toAgentId, v.thisCampaignOnly ? this.campaignId : null);
  }

  statusBadgeClass(status: string): string {
    return `das-badge das-badge--${status.toLowerCase()}`;
  }
}
