import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { ClosesFacade } from '../../core/closes/store/closes.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { BasemapLayerGroup, DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig, TileFeatureStateMap, TileFilter, TileLayerBinding } from '../../core/ui/map/map.models';
import { unionBounds, wktBounds, wktPoint } from '../../core/ui/map/wkt.util';
import { HierarchyCascadeComponent } from '../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { HierarchySelection } from '../../core/hierarchy/models/hierarchy.models';
import { HierarchyFacade } from '../../core/hierarchy/store/hierarchy.facade';
import { Close, CloseStreetOption } from '../../core/closes/models/closes.models';
import { Block, UUID, UserRole } from '../../core/models/das.models';
import { STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP } from '../../core/ui/map/basemap-groups';

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

/** Parcelle arrivant avec un bloc rattaché / déjà dans la close / au code figé (numéro inchangé) / figé et déplacé (bloquant). */
const PLAN_ENTERING_COLOR = '#2563eb';
const PLAN_EXISTING_COLOR = '#0d9488';
const PLAN_LOCKED_COLOR = '#6b7280';
const PLAN_FROZEN_COLOR = '#dc2626';

/**
 * Overrides live ; la coloration de base reste bakée dans le style (CLAUDE.md §4).
 *
 * Trois états, et ils ne sont appliqués QUE pendant la gestion des blocs d'une close. Hors de
 * ce mode, les blocs gardent leur couleur de base — celle du statut de campagne, qui est
 * l'information de travail du reste de l'application. La recouvrir en permanence ferait perdre
 * une lecture pour en gagner une autre.
 */
const IN_CLOSE_COLOR = '#2563eb';   // dans la close en cours
const FREE_COLOR = '#16a34a';       // libre : cliquable
const TAKEN_COLOR = '#9aa3b5';      // pris par une autre close : non cliquable

const BLOCS_TILE: TileLayerBinding = {
  id: 'closes-blocs', labelKey: 'nav.blocks', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

/**
 * Liaison vers la voirie du référentiel, pour pouvoir la SURLIGNER au survol de la liste des
 * rues. `promoteId: "Id"` est déjà posé sur la source dans `map-style.json` : l'id de feature
 * est l'id de la rue, aucune résolution à faire.
 */
const STREETS_TILE: TileLayerBinding = {
  id: 'closes-streets', labelKey: 'map.basemap.streets', source: 'streets',
  sourceLayer: 'streets_tiles',
  styleLayerIds: ['streets-track', 'streets-minor-case', 'streets-minor-fill',
    'streets-major-case', 'streets-major-fill', 'streets-name'],
  interactiveLayerId: 'streets-minor-fill', visible: true,
};

/** Rue survolée dans la liste, ou cliquée sur la carte. */
const STREET_HOVER_COLOR = '#dc2626';

@Component({
  selector: 'das-closes',
  standalone: true,
  imports: [AsyncPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent, HierarchyCascadeComponent],
  templateUrl: './closes.component.html',
  styleUrl: './closes.component.scss',
})
export class ClosesComponent implements OnInit {

  /**
   * Voirie et contours du style de base, pilotables depuis le panneau des couches. Le panneau
   * a été activé sur cette carte le 2026-08-25 : depuis le retrait du fond CARTO, la voirie est
   * la seule référence de terrain, et il faut pouvoir la masquer pour lire les contours dessous.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [STREETS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, ADRESSES_BASEMAP_GROUP];
  private facade = inject(ClosesFacade);
  private authFacade = inject(AuthFacade);
  private hierarchy = inject(HierarchyFacade);

  protected readonly isListLoading$ = this.facade.isListLoading$;
  protected readonly isSaving$ = this.facade.isSaving$;
  protected readonly errorMessageKey$ = this.facade.errorMessageKey$;

  protected readonly closes = toSignal(this.facade.closes$, { initialValue: [] as Close[] });
  protected readonly blocs = toSignal(this.facade.blocs$, { initialValue: [] as Block[] });
  protected readonly streets = toSignal(this.facade.streets$, { initialValue: [] as CloseStreetOption[] });
  protected readonly quartierId = toSignal(this.facade.quartierId$, { initialValue: null as UUID | null });
  private readonly blocOwner = toSignal(this.facade.blocOwner$, { initialValue: new Map<UUID, Close>() });
  private readonly takenNumbers = toSignal(this.facade.takenNumbers$, { initialValue: new Map<number, Close>() });
  private readonly saveTick = toSignal(this.facade.saveTick$, { initialValue: 0 });

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  /** État purement local du formulaire — il meurt avec l'écran, rien à faire dans le store. */
  protected readonly editing = signal<UUID | 'new' | null>(null);
  protected readonly formStreetId = signal<UUID | null>(null);

  /**
   * Numéro et code d'une close en MODIFICATION. En création ils ne sont pas saisis : ils sont
   * dérivés (`nextFreeNumber` / `generatedCode`). Le back exige les deux champs à chaque appel,
   * c'est donc le front qui les fournit — mais l'opérateur n'a plus à inventer un identifiant
   * dont il ne connaît pas les règles d'unicité.
   */
  private readonly editNumber = signal<number | null>(null);
  private readonly editCode = signal('');

  /** Close dont on gère les blocs. Distinct de l'édition de la fiche : ce sont deux routes back. */
  protected readonly managing = signal<UUID | null>(null);

  /* ---- Plan de numérotation ------------------------------------------------ */
  protected readonly plan = toSignal(this.facade.plan$, { initialValue: null });
  protected readonly planIssues = toSignal(this.facade.planIssues$, {
    initialValue: { duplicates: [] as number[], frozen: [] as string[], outOfRange: [] as string[] },
  });
  protected readonly canApplyPlan = toSignal(this.facade.canApplyPlan$, { initialValue: false });
  protected readonly isPreviewing$ = this.facade.isPreviewing$;
  /** Blocs cochés en attente d'aperçu — le rattachement ne part plus directement. */
  protected readonly pendingBlocIds = signal<UUID[]>([]);
  protected readonly planReverse = signal(false);
  protected readonly highlightedCloseId = signal<UUID | null>(null);

  /** Rue survolée dans la liste. Pilote la surbrillance carte, rien d'autre. */
  protected readonly hoveredStreetId = signal<UUID | null>(null);
  /** Filtre de la liste des rues — indispensable dès que l'import OSM en aura versé des centaines. */
  protected readonly streetSearch = signal('');

  protected readonly tileLayers: TileLayerBinding[] = [BLOCS_TILE, STREETS_TILE];

  constructor() {
    // Referme le formulaire UNIQUEMENT sur écriture réussie : sur un 409 il reste ouvert avec la
    // saisie intacte. Le panneau blocs, lui, reste ouvert — on y enchaîne les rattachements.
    effect(() => {
      this.saveTick();
      this.editing.set(null);
    });
  }

  ngOnInit(): void { this.facade.loadStreets(); }

  protected readonly managedClose = computed(() =>
    this.closes().find((c) => c.id === this.managing()) ?? null);

  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const q = this.quartierId();
    return { 'closes-blocs': q ? ['==', ['get', 'QuartierId'], q] : null };
  });

  /**
   * Bleu = dans la close gérée · vert = libre, cliquable · gris = pris ailleurs.
   * Rouge = rue survolée dans la liste, ou rue déjà choisie dans le formulaire.
   *
   * Le vert n'est posé QUE en mode gestion : c'est lui qui transforme la carte en surface de
   * sélection. Sans lui, un bloc libre garde sa couleur de statut de campagne et rien ne
   * distingue « cliquable » de « déjà pris ailleurs » — c'est précisément ce qui manquait.
   */
  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const blocStates: TileFeatureStateMap = {};
    const managing = this.managing();
    const focus = managing ?? this.highlightedCloseId();
    const owner = this.blocOwner();

    for (const [blocId, close] of owner) {
      blocStates[blocId] = { colorOverride: close.id === focus ? IN_CLOSE_COLOR : TAKEN_COLOR };
    }
    if (managing) {
      for (const b of this.blocs()) {
        if (!owner.has(b.id)) blocStates[b.id] = { colorOverride: FREE_COLOR };
      }
    }

    const streetStates: TileFeatureStateMap = {};
    // Le survol l'emporte sur la sélection : c'est le geste en cours qui doit se voir.
    const street = this.hoveredStreetId() ?? this.formStreetId();
    if (street) streetStates[street] = { colorOverride: STREET_HOVER_COLOR };

    return { 'closes-blocs': blocStates, 'closes-streets': streetStates };
  });

  /** Rues filtrées par la recherche. Le tri met les rues nommées devant : elles se reconnaissent. */
  protected readonly visibleStreets = computed(() => {
    const q = this.streetSearch().trim().toLowerCase();
    const list = q
      ? this.streets().filter((s) => this.streetLabel(s).toLowerCase().includes(q))
      : this.streets();
    return [...list].sort((a, b) => Number(!a.name) - Number(!b.name)
      || this.streetLabel(a).localeCompare(this.streetLabel(b)));
  });

  /** Cadrage sur l'union des blocs de la close ciblée — la « géométrie » d'une close, ce sont ses blocs. */
  protected readonly mapFitBbox = computed(() => {
    const focusId = this.managing() ?? this.highlightedCloseId();
    const close = this.closes().find((c) => c.id === focusId);
    if (!close || close.blocs.length === 0) return null;
    const ids = close.blocs.map((b) => b.id);
    const blocs = this.blocs().filter((b) => ids.includes(b.id));
    return unionBounds(blocs.map((b) => (b.boundaryWkt ? wktBounds(b.boundaryWkt) : null)));
  });

  /**
   * Blocs du quartier proposables à la close gérée, chacun avec sa close propriétaire s'il en a
   * une. Les blocs de la close gérée en sont exclus : ils sont listés au-dessus, cochés.
   *
   * Un bloc déjà pris est **montré et désactivé**, pas masqué. Le masquer laissait l'opérateur
   * devant une liste incomplète sans lui dire pourquoi — il ne pouvait pas distinguer « ce bloc
   * n'existe pas dans ce quartier » de « ce bloc est déjà ailleurs ». Désactivé et légendé, il
   * répond à la question et indique où aller le détacher.
   *
   * Le back accepterait le déplacement direct (`AttachBlocsHandler` traite un bloc déjà rattaché
   * comme un transfert, refusé seulement sur code d'adresse figé). On ne l'expose pas : tant que
   * la renumérotation par close n'a pas eu lieu, ce déplacement partirait presque toujours en
   * 409 `Closes.DuplicateAdresseNumero`. Le détachement explicite reste le chemin lisible.
   */
  protected readonly selectableBlocs = computed(() => {
    const owner = this.blocOwner();
    const managedId = this.managing();
    return this.blocs()
      .filter((b) => owner.get(b.id)?.id !== managedId)
      .map((b) => ({ bloc: b, takenBy: owner.get(b.id) ?? null }));
  });

  /**
   * Code du quartier courant, lu dans la hiérarchie. Repli sur une close existante : après un
   * rechargement direct de l'écran, la cascade peut ne pas encore avoir peuplé ses quartiers
   * alors que la liste des closes, elle, porte déjà `quartierCode`.
   */
  protected readonly quartierCode = computed(() => {
    const id = this.quartierId();
    if (!id) return '';
    return this.hierarchy.quartiers().find((q) => q.id === id)?.code
      ?? this.closes().find((c) => c.quartierId === id)?.quartierCode
      ?? '';
  });

  /**
   * Plus petit numéro libre du quartier, pas `max + 1` : après une suppression, un trou doit se
   * refermer. Le numéro entre dans le code d'adresse — laisser des trous rendrait la
   * numérotation des closes illisible sur le terrain.
   */
  protected readonly nextFreeNumber = computed(() => {
    const taken = this.takenNumbers();
    let n = 1;
    while (taken.has(n)) n++;
    return n;
  });

  /** Format arrêté le 2026-08-25 : code du quartier + numéro sur deux chiffres (`Q7-03`). */
  protected readonly generatedCode = computed(
    () => `${this.quartierCode()}-${String(this.nextFreeNumber()).padStart(2, '0')}`);

  /**
   * Le numéro n'est plus saisi, donc plus jamais en collision au moment du clic. Il peut le
   * devenir entre le calcul et l'envoi si un collègue crée une close en même temps : c'est le
   * back qui tranche (409), et l'effet recharge alors la liste pour que la tentative suivante
   * reparte d'un numéro libre.
   */
  protected readonly canSave = computed(() =>
    this.formStreetId() !== null
    && this.quartierId() !== null
    && this.nextFreeNumber() <= 999
    && (this.editing() !== 'new' || this.quartierCode() !== ''),
  );

  onHierarchy(sel: HierarchySelection): void {
    this.editing.set(null);
    this.managing.set(null);
    this.facade.selectQuartier(sel.quartierId);
  }

  highlight(id: UUID | null): void { this.highlightedCloseId.set(id); }

  startCreate(): void {
    this.managing.set(null);
    this.editing.set('new');
    this.formStreetId.set(null);
  }

  /** En modification on CONSERVE numéro et code : les régénérer renumérerait une close en place. */
  startEdit(c: Close): void {
    this.managing.set(null);
    this.editing.set(c.id);
    this.formStreetId.set(c.streetId);
    this.editNumber.set(c.number);
    this.editCode.set(c.code);
  }

  cancelEdit(): void { this.editing.set(null); }

  save(): void {
    if (!this.canSave()) return;
    const id = this.editing();
    const creating = id === 'new';
    this.facade.save(creating ? null : id, {
      quartierId: this.quartierId()!,
      streetId: this.formStreetId()!,
      number: creating ? this.nextFreeNumber() : this.editNumber()!,
      code: creating ? this.generatedCode() : this.editCode(),
      boundaryWkt: null,
    });
  }

  remove(c: Close): void { this.facade.remove(c.id); }

  manageBlocs(c: Close): void {
    this.editing.set(null);
    this.managing.update((cur) => (cur === c.id ? null : c.id));
  }

  /* ---- Parcours aperçu → validation → application -------------------------- */

  /** Coche/décoche un bloc candidat. Rien n'est envoyé : l'aperçu est explicite. */
  togglePendingBloc(blocId: UUID): void {
    if (this.blocOwner().get(blocId)) return;
    this.pendingBlocIds.update((ids) => ids.includes(blocId) ? ids.filter((x) => x !== blocId) : [...ids, blocId]);
  }

  isPending(blocId: UUID): boolean { return this.pendingBlocIds().includes(blocId); }

  /**
   * Demande la proposition de numérotation. `blocIds` peut être vide : on obtient alors une
   * proposition pour la close telle qu'elle est — c'est la façon de vérifier après coup qu'une
   * numérotation est stable (`changedCount` à 0).
   */
  preview(): void {
    const closeId = this.managing();
    if (closeId) this.facade.previewNumbering(closeId, this.pendingBlocIds(), this.planReverse());
  }

  /** Le sens de parcours brut est arbitraire : si le plan commence par le mauvais bout, on le rejoue inversé. */
  toggleReverse(): void {
    this.planReverse.update((r) => !r);
    this.preview();
  }

  editNumero(adresseId: UUID, value: number | null): void {
    if (value === null || Number.isNaN(value)) return;
    this.facade.editPlannedNumero(adresseId, value);
  }

  discardPlan(): void {
    this.facade.discardPlan();
    this.pendingBlocIds.set([]);
    this.planReverse.set(false);
  }

  /** Applique le plan RELU — rattachement et renumérotation dans la même transaction côté back. */
  applyPlan(): void {
    const closeId = this.managing();
    if (closeId && this.canApplyPlan()) this.facade.attachBlocs(closeId, this.pendingBlocIds());
  }

  /**
   * Le plan projeté sur la carte : un point par parcelle, portant son numéro EFFECTIF en libellé
   * permanent. C'est le seul rendu qui permette de vérifier ce qu'on valide — voir que le 1
   * précède le 2 le long de la voie. Les parcelles entrantes se distinguent de celles déjà
   * rattachées, et un code figé passe en rouge : son numéro ne peut pas bouger.
   */
  protected readonly planFeatures = computed<MapFeature[]>(() => {
    const p = this.plan();
    if (!p) return [];
    const frozen = new Set(this.planIssues().frozen);
    return p.adresses.flatMap((a) => {
      const pt = wktPoint(a.locationWkt);
      if (!pt) return [];
      return [{
        id: a.adresseId,
        layerId: 'plan',
        geometry: pt,
        color: a.addressCode ? (frozen.has(a.adresseId) ? PLAN_FROZEN_COLOR : PLAN_LOCKED_COLOR)
          : a.entering ? PLAN_ENTERING_COLOR : PLAN_EXISTING_COLOR,
        label: String(a.effectiveNumero),
        selectable: false,
      }];
    });
  });

  protected readonly planLayers: MapLayerConfig[] = [
    { id: 'plan', labelKey: 'closes.planLayer', type: 'point', visible: true, showLabels: true },
  ];

  detachBloc(blocId: UUID): void {

    const closeId = this.managing();
    if (closeId) this.facade.detachBloc(closeId, blocId);
  }

  /**
   * Clic carte. Deux couches sont interactives sur cet écran (blocs et rues) et `featureSelect`
   * n'émet que l'id, sans dire d'où il vient : c'est donc à l'appelant de trancher, en regardant
   * dans quel jeu l'id existe. Sans cette garde, cliquer une rue enverrait son id à
   * `attachBlocs` et produirait un 404 incompréhensible.
   */
  onMapFeature(id: UUID): void {
    if (this.streets().some((s) => s.id === id)) { this.pickStreet(id); return; }
    if (this.blocs().some((b) => b.id === id)) this.onMapBloc(id);
  }

  /**
   * Rattache un bloc libre, détache un bloc de la close gérée. Un bloc pris par une AUTRE close
   * ne fait rien — même règle que la case désactivée de la liste (cf. `selectableBlocs`), les
   * deux entrées doivent se comporter pareil.
   */
  private onMapBloc(blocId: UUID): void {
    if (!this.managing()) return;
    const owner = this.blocOwner().get(blocId);
    if (owner?.id === this.managing()) this.detachBloc(blocId);
    else if (!owner) this.togglePendingBloc(blocId);
  }

  /** Choisir une rue depuis la liste ou depuis la carte : même chemin, même résultat. */
  pickStreet(id: UUID | null): void {
    if (this.editing() === null) return;
    this.formStreetId.set(id);
  }

  hoverStreet(id: UUID | null): void { this.hoveredStreetId.set(id); }

  /** La légende lit les mêmes constantes que la carte : deux sources de vérité divergeraient. */
  protected readonly colors = { inClose: IN_CLOSE_COLOR, free: FREE_COLOR, taken: TAKEN_COLOR };

  streetLabel(s: CloseStreetOption): string { return s.name ?? s.code; }
  blocLabel(b: Block): string { return b.name ?? b.code; }
}
