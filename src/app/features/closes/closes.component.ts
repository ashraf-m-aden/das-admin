import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { ClosesFacade } from '../../core/closes/store/closes.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { TileFeatureStateMap, TileFilter, TileLayerBinding } from '../../core/ui/map/map.models';
import { unionBounds, wktBounds } from '../../core/ui/map/wkt.util';
import { HierarchyCascadeComponent } from '../../core/hierarchy/ui/hierarchy-cascade/hierarchy-cascade.component';
import { HierarchySelection } from '../../core/hierarchy/models/hierarchy.models';
import { Close, CloseStreetOption } from '../../core/closes/models/closes.models';
import { Block, UUID, UserRole } from '../../core/models/das.models';

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

/** Override live ; la coloration de base reste bakée dans le style (CLAUDE.md §4). */
const SELECTED_COLOR = '#2563eb';
const TAKEN_COLOR = '#9aa3b5';

const BLOCS_TILE: TileLayerBinding = {
  id: 'closes-blocs', labelKey: 'nav.blocks', source: 'blocs', sourceLayer: 'blocs_tiles',
  styleLayerIds: ['blocs-fill', 'blocs-line'], interactiveLayerId: 'blocs-fill', visible: true,
};

@Component({
  selector: 'das-closes',
  standalone: true,
  imports: [AsyncPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent, HierarchyCascadeComponent],
  templateUrl: './closes.component.html',
  styleUrl: './closes.component.scss',
})
export class ClosesComponent implements OnInit {
  private facade = inject(ClosesFacade);
  private authFacade = inject(AuthFacade);

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
  protected readonly formNumber = signal<number | null>(null);
  protected readonly formCode = signal('');

  /** Close dont on gère les blocs. Distinct de l'édition de la fiche : ce sont deux routes back. */
  protected readonly managing = signal<UUID | null>(null);
  protected readonly highlightedCloseId = signal<UUID | null>(null);

  protected readonly tileLayers: TileLayerBinding[] = [BLOCS_TILE];

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

  /** Bleu = blocs de la close ciblée, gris = pris par une autre close. */
  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const states: TileFeatureStateMap = {};
    const focus = this.managing() ?? this.highlightedCloseId();
    for (const [blocId, close] of this.blocOwner()) {
      states[blocId] = { colorOverride: close.id === focus ? SELECTED_COLOR : TAKEN_COLOR };
    }
    return { 'closes-blocs': states };
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

  /** Blocs encore libres du quartier — un bloc n'appartient qu'à UNE close. */
  protected readonly freeBlocs = computed(() => this.blocs().filter((b) => !b.closeId));

  protected readonly numberCollision = computed(() => {
    const n = this.formNumber();
    if (n === null) return null;
    const owner = this.takenNumbers().get(n);
    return owner && owner.id !== this.editing() ? owner : null;
  });

  protected readonly canSave = computed(() =>
    this.formStreetId() !== null
    && this.formNumber() !== null
    && this.formNumber()! >= 1 && this.formNumber()! <= 999
    && this.formCode().trim().length > 0
    && this.quartierId() !== null
    && this.numberCollision() === null,
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
    this.formNumber.set(null);
    this.formCode.set('');
  }

  startEdit(c: Close): void {
    this.managing.set(null);
    this.editing.set(c.id);
    this.formStreetId.set(c.streetId);
    this.formNumber.set(c.number);
    this.formCode.set(c.code);
  }

  cancelEdit(): void { this.editing.set(null); }

  save(): void {
    if (!this.canSave()) return;
    const id = this.editing();
    this.facade.save(id === 'new' ? null : id, {
      quartierId: this.quartierId()!,
      streetId: this.formStreetId()!,
      number: this.formNumber()!,
      code: this.formCode().trim(),
      boundaryWkt: null,
    });
  }

  remove(c: Close): void { this.facade.remove(c.id); }

  manageBlocs(c: Close): void {
    this.editing.set(null);
    this.managing.update((cur) => (cur === c.id ? null : c.id));
  }

  /**
   * Un bloc à la fois, volontairement. Le back refuse (409) le rattachement dès que la réunion
   * des blocs ferait porter le même numéro à deux parcelles — et comme chaque bloc numérote à
   * partir de 1, c'est la règle plus que l'exception tant que la renumérotation n'a pas eu lieu.
   * Envoyer un lot ferait échouer le tout pour un seul bloc fautif, sans dire lequel.
   */
  attachBloc(blocId: UUID): void {
    const closeId = this.managing();
    if (closeId) this.facade.attachBlocs(closeId, [blocId]);
  }

  detachBloc(blocId: UUID): void {
    const closeId = this.managing();
    if (closeId) this.facade.detachBloc(closeId, blocId);
  }

  /** Clic carte : rattache un bloc libre, détache un bloc de la close gérée. */
  onMapBloc(blocId: UUID): void {
    if (!this.managing()) return;
    const owner = this.blocOwner().get(blocId);
    if (owner?.id === this.managing()) this.detachBloc(blocId);
    else if (!owner) this.attachBloc(blocId);
  }

  streetLabel(s: CloseStreetOption): string { return s.name ?? s.code; }
  blocLabel(b: Block): string { return b.name ?? b.code; }
}
