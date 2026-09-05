import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import { FieldOpsFacade } from '../../../core/fieldops/store/fieldops.facade';
import { StaffFacade } from '../../../core/staff/store/staff.facade';
import { BlocksFacade } from '../../../core/blocks/store/blocks.facade';
import { ReviewFacade } from '../../../core/review/store/review.facade';
import { PageHeaderComponent } from '../../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../../core/i18n/das-locale.pipes';
import { HierarchyCascadeComponent } from '../../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { HierarchySelection } from '../../../core/hierarchy/models/hierarchy.models';
import { BasemapLayerGroup, DasMapComponent } from '../../../core/ui/map/das-map.component';
import { CampaignProgressComponent } from '../campaign-progress/campaign-progress.component';
import { CampaignSurveysComponent } from '../campaign-surveys/campaign-surveys.component';
import { CampaignRoadmapComponent } from '../campaign-roadmap/campaign-roadmap.component';
import { TileFeatureStateMap, TileFilter, TileLayerBinding } from '../../../core/ui/map/map.models';
import { unionBounds, wktBounds } from '../../../core/ui/map/wkt.util';
import { Assignment, AssignmentStatus, Block, CampaignBloc, UUID } from '../../../core/models/das.models';
import { SurveyStatus } from '../../../core/review/models/review.models';
import { StaffMember } from '../../../core/staff/models/staff.models';
import {
  STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
} from '../../../core/ui/map/basemap-groups';

/** Palette distincte et stable par agent — même génération de couleur que dans le template (agentColor). */
const AGENT_PALETTE = ['#2563eb', '#d97706', '#16a34a', '#7c3aed', '#dc2626', '#0d9488', '#db2777', '#65a30d'];

/** Bloc coché en vue d'une affectation. Distinct de toute couleur d'agent, sinon la sélection se confond avec un bloc déjà attribué. */
const SELECTION_COLOR = '#0f172a';

/**
 * La couche des blocs, ici à double emploi : elle montre les blocs DÉJÀ AFFECTÉS (colorés par
 * agent) et les blocs CANDIDATS ramenés par le filtre hiérarchique, sur lesquels on clique
 * pour composer l'affectation. Un seul calque pour les deux : ce sont les mêmes objets, les
 * dédoubler obligerait à faire correspondre deux jeux de couleurs sur la même géométrie.
 *
 * `togglable: false` serait faux ici — cette carte n'expose pas `BLOCS_BASEMAP_GROUP`, donc
 * c'est bien ce binding qui porte la case à cocher des blocs.
 */
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
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, TranslocoModule, DasDatePipe, PageHeaderComponent, HierarchyCascadeComponent, DasMapComponent, CampaignProgressComponent, CampaignSurveysComponent, CampaignRoadmapComponent],
  templateUrl: './campaign-detail.component.html',
  styleUrl: './campaign-detail.component.scss',
})
export class CampaignDetailComponent implements OnInit, OnDestroy {

  /**
   * Voirie et contours du style de base, pilotables depuis le panneau des couches. Le panneau
   * a été activé sur cette carte le 2026-08-25 : depuis le retrait du fond CARTO, la voirie est
   * la seule référence de terrain, et il faut pouvoir la masquer pour lire les contours dessous.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, COUNTRY_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP, CITIES_BASEMAP_GROUP,
  ];
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected facade = inject(FieldOpsFacade);
  private staffFacade = inject(StaffFacade);
  protected blocksFacade = inject(BlocksFacade);
  private reviewFacade = inject(ReviewFacade);

  protected readonly campaignId = this.route.snapshot.paramMap.get('id') ?? '';

  /** Cible du défilement depuis les compteurs de l'avancement. Absente tant que la campagne charge. */
  private readonly surveysSection = viewChild('surveysSection', { read: ElementRef<HTMLElement> });

  protected readonly campaign = toSignal(this.facade.selectedCampaign$);
  protected readonly progress = toSignal(this.facade.progress$);
  protected readonly campaignBlocs = toSignal(this.facade.campaignBlocs$, { initialValue: [] as CampaignBloc[] });
  protected readonly assignments = toSignal(this.facade.assignments$, { initialValue: [] });

  private readonly staff = toSignal(this.staffFacade.items$, { initialValue: [] as StaffMember[] });
  protected readonly agents = computed(() => this.staff().filter((s) => s.isActive && s.roles.includes('AgentTerrain')));

  protected readonly blocks = toSignal(this.blocksFacade.items$, { initialValue: [] as Block[] });
  protected readonly selectedBlocIds = signal<Set<UUID>>(new Set());
  protected readonly assignedBlocIds = computed(() => new Set(this.campaignBlocs().map((cb) => cb.blocId)));

  protected readonly editingCampaign = signal(false);

  protected readonly assignBlocForm = this.fb.nonNullable.group({ agentId: ['', [Validators.required]] });
  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    deadline: ['', [Validators.required]],
  });

  // ---- Carte de travail ------------------------------------------------------

  protected readonly mapAgentFilter = signal<UUID | null>(null);

  /** Bloc mis en évidence par le bouton « Voir » — prioritaire sur tout autre cadrage. */
  protected readonly focusedBlocId = signal<UUID | null>(null);

  protected readonly mapAgents = computed(() => {
    const seen = new Map<UUID, string>();
    for (const cb of this.campaignBlocs()) seen.set(cb.agentId, cb.agentFullName);
    return [...seen.entries()].map(([id, name]) => ({ id, name, color: hashColor(id) }));
  });

  protected readonly tileLayers: TileLayerBinding[] = [CAMPAIGN_BLOCS_TILE];

  /** Blocs candidats du filtre courant, hors ceux déjà affectés à la campagne. */
  protected readonly candidateBlocs = computed(() => {
    const pris = this.assignedBlocIds();
    return this.blocks().filter((b) => !pris.has(b.id));
  });

  private readonly candidateIds = computed(() => new Set(this.candidateBlocs().map((b) => b.id)));

  /**
   * Blocs candidats SANS emprise : ils ne peuvent pas être cliqués sur la carte.
   *
   * Les lister à part est le seul moyen de ne pas les perdre. Remplacer la liste par la carte
   * rendrait sinon ces blocs-là définitivement inatteignables, sans que rien ne le signale —
   * une régression silencieuse, du genre qu'on ne découvre qu'en cherchant un bloc absent.
   */
  protected readonly candidatesWithoutGeometry = computed(() =>
    this.candidateBlocs().filter((b) => !b.boundaryWkt));

  protected readonly selectedBlocs = computed(() => {
    const sel = this.selectedBlocIds();
    return this.blocks().filter((b) => sel.has(b.id));
  });

  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const states: TileFeatureStateMap = {};
    for (const cb of this.campaignBlocs()) states[cb.blocId] = { colorOverride: hashColor(cb.agentId) };
    // La sélection passe APRÈS : un bloc coché doit se lire comme coché, pas comme attribué.
    for (const id of this.selectedBlocIds()) states[id] = { colorOverride: SELECTION_COLOR, selected: true };
    const focus = this.focusedBlocId();
    if (focus) states[focus] = { ...states[focus], selected: true };
    return { 'campaign-blocs': states };
  });

  /**
   * Le filtre montre les blocs de la campagne ET les candidats du filtre hiérarchique.
   *
   * Sans les candidats, la carte ne pourrait servir qu'à relire l'existant : on ne peut pas
   * cliquer un bloc qu'elle n'affiche pas. C'est ce qui permet de remplacer la liste à cocher.
   */
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const campagne = this.campaignBlocs()
      .filter((cb) => !this.mapAgentFilter() || cb.agentId === this.mapAgentFilter())
      .map((cb) => cb.blocId);
    // Sous filtre agent, les candidats resteraient hors sujet : on ne montre alors que sa charge.
    const candidats = this.mapAgentFilter() ? [] : this.candidateBlocs().map((b) => b.id);
    const ids = [...new Set([...campagne, ...candidats])];
    const clause: ExpressionSpecification = ['in', ['get', 'Id'], ['literal', ids]];
    return { 'campaign-blocs': (ids.length ? clause : ['==', ['get', 'Id'], '___none___']) as FilterSpecification };
  });

  /** WKT par blocId, chargé dès que la liste des blocs de la campagne change — sert uniquement à cadrer la carte. */
  private readonly blocBoundaries = signal<Record<UUID, string>>({});

  /** Emprise d'un bloc, qu'il vienne de la campagne (WKT chargé à part) ou du filtre (WKT porté par le bloc). */
  private boundsOf(blocId: UUID): [number, number, number, number] | null {
    const wkt = this.blocBoundaries()[blocId] ?? this.blocks().find((b) => b.id === blocId)?.boundaryWkt;
    return wkt ? wktBounds(wkt) : null;
  }

  /** Emprise de tous les blocs de la campagne — cadrage par défaut à l'entrée sur l'écran. */
  protected readonly campaignBbox = computed(() =>
    unionBounds(this.campaignBlocs().map((cb) => this.boundsOf(cb.blocId))));

  /**
   * Cadrage, du plus précis au plus large : le bloc qu'on vient de demander à voir, puis la
   * charge de l'agent filtré, puis les candidats que le filtre vient de ramener, puis la
   * campagne entière. Chaque niveau répond à un geste que l'opérateur vient de faire.
   */
  protected readonly mapFitBbox = computed(() => {
    const focus = this.focusedBlocId();
    if (focus) return this.boundsOf(focus);

    const agent = this.mapAgentFilter();
    if (agent) {
      return unionBounds(this.campaignBlocs().filter((cb) => cb.agentId === agent).map((cb) => this.boundsOf(cb.blocId)));
    }

    const candidats = this.candidateBlocs();
    if (candidats.length) return unionBounds(candidats.map((b) => this.boundsOf(b.id)));

    return this.campaignBbox();
  });

  agentColor(agentId: string): string { return hashColor(agentId); }

  filterMapAgent(agentId: UUID | null): void {
    this.mapAgentFilter.set(agentId);
    this.focusedBlocId.set(null);
  }

  /** « Voir » : recadre la carte sur un bloc précis de la liste des affectations. */
  focusBloc(blocId: UUID): void { this.focusedBlocId.set(blocId); }
  clearFocus(): void { this.focusedBlocId.set(null); }

  /**
   * Clic sur un bloc de la carte.
   *
   * Un bloc déjà affecté n'est pas sélectionnable — le cliquer le met en évidence, ce qui
   * répond à la question qu'on se pose en le cliquant (« lequel est-ce ? ») au lieu de ne
   * rien faire. Un bloc hors du filtre courant est ignoré : il n'est pas candidat.
   */
  onMapBloc(blocId: string): void {
    if (this.assignedBlocIds().has(blocId)) { this.focusedBlocId.set(blocId); return; }
    if (!this.candidateIds().has(blocId)) return;
    this.toggleBloc(blocId);
  }

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
    this.focusedBlocId.set(null);
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

  clearSelection(): void { this.selectedBlocIds.set(new Set()); }

  submitAssignBlocs(): void {
    if (this.assignBlocForm.invalid || this.selectedBlocIds().size === 0) { this.assignBlocForm.markAllAsTouched(); return; }
    const agentId = this.assignBlocForm.getRawValue().agentId;
    for (const blocId of this.selectedBlocIds()) this.facade.assignBloc(this.campaignId, blocId, agentId);
    this.selectedBlocIds.set(new Set());
  }

  /**
   * Clic sur un compteur de relevés de l'avancement : la section des relevés se recharge sur
   * ce statut, puis on l'amène à l'écran.
   *
   * L'ordre passe par la facade review, pas par une entrée du composant : c'est le store qui
   * porte déjà l'onglet affiché, et `das-campaign-surveys` l'y lit. Deux sources — une entrée
   * ici, le store là-bas — se seraient désynchronisées dès que la section change d'onglet
   * elle-même. Aucun appel réseau : la liste est déjà chargée, on ne fait que la filtrer.
   */
  showSurveys(status: SurveyStatus): void {
    this.reviewFacade.setCampaignSurveyStatus(status);
    this.surveysSection()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  startCampaign(): void { this.facade.startCampaign(this.campaignId); }
  populateCampaign(): void { this.facade.populateCampaign(this.campaignId); }
  extendCampaign(): void { this.facade.extendCampaign(this.campaignId); }
  closeCampaign(): void { this.facade.closeCampaign(this.campaignId); }

  /**
   * Pastille de statut de la CAMPAGNE, dans l'en-tête. Les statuts de parcelle ont leur propre
   * copie dans `das-campaign-roadmap` : les deux vocabulaires (`Planned/InProgress/Closed` et
   * `ToDo/Done/Abandoned`) n'ont rien en commun, les partager créerait une dépendance entre
   * deux panneaux qui n'en ont pas.
   */
  statusBadgeClass(status: string): string {
    return `das-badge das-badge--${status.toLowerCase()}`;
  }
}
