import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { Close } from '../../core/closes/models/closes.models';
import { Block, UUID, UserRole } from '../../core/models/das.models';

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

/** Bleu de sélection, appliqué en `feature-state.colorOverride` — la coloration de base reste bakée dans le style. */
const SELECTED_COLOR = '#2563eb';
/** Gris : bloc déjà pris par une AUTRE close, non sélectionnable. */
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
export class ClosesComponent {
  private facade = inject(ClosesFacade);
  private authFacade = inject(AuthFacade);

  protected readonly isListLoading$ = this.facade.isListLoading$;
  protected readonly isSaving$ = this.facade.isSaving$;
  protected readonly errorMessageKey$ = this.facade.errorMessageKey$;

  protected readonly closes = toSignal(this.facade.closes$, { initialValue: [] as Close[] });
  protected readonly blocs = toSignal(this.facade.blocs$, { initialValue: [] as Block[] });
  protected readonly quartierId = toSignal(this.facade.quartierId$, { initialValue: null as UUID | null });
  private readonly blocOwner = toSignal(this.facade.blocOwner$, { initialValue: new Map<UUID, Close>() });
  private readonly saving = toSignal(this.facade.isSaving$, { initialValue: false });
  private readonly saveTick = toSignal(this.facade.saveTick$, { initialValue: 0 });

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  /** État purement local du formulaire — n'a pas sa place dans le store, il meurt avec l'écran. */
  protected readonly editing = signal<UUID | 'new' | null>(null);
  protected readonly formName = signal('');
  protected readonly formNumber = signal<number | null>(null);
  protected readonly formBlocIds = signal<UUID[]>([]);
  protected readonly highlightedCloseId = signal<UUID | null>(null);

  private readonly takenNumbers = toSignal(this.facade.takenNumbers$, { initialValue: new Map<number, Close>() });

  /** Numéro déjà porté par une AUTRE close du quartier — signalé avant l'envoi plutôt qu'au 409. */
  protected readonly numberCollision = computed(() => {
    const n = this.formNumber();
    if (n === null) return null;
    const owner = this.takenNumbers().get(n);
    return owner && owner.id !== this.editing() ? owner : null;
  });

  constructor() {
    // Referme le formulaire UNIQUEMENT sur une écriture réussie : sur un 409 (numéro déjà pris,
    // bloc déjà affecté) il reste ouvert avec la saisie intacte, l'opérateur corrige et renvoie.
    effect(() => {
      this.saveTick();
      this.editing.set(null);
    });
  }

  protected readonly tileLayers: TileLayerBinding[] = [BLOCS_TILE];

  /** Limite la carte au quartier choisi — même mécanisme que le registre adresses. */
  protected readonly tileFilters = computed<Record<string, TileFilter>>(() => {
    const q = this.quartierId();
    return { 'closes-blocs': q ? ['==', ['get', 'QuartierId'], q] : null };
  });

  /**
   * Bleu = sélectionné dans le formulaire, gris = déjà pris par une autre close.
   * Hors édition, on colorie les blocs de la close survolée dans la liste.
   */
  protected readonly tileFeatureStates = computed<Record<string, TileFeatureStateMap>>(() => {
    const states: TileFeatureStateMap = {};
    const owner = this.blocOwner();
    const selfId = this.editing();

    if (selfId !== null) {
      for (const [blocId, close] of owner) {
        if (close.id !== selfId) states[blocId] = { colorOverride: TAKEN_COLOR };
      }
      for (const id of this.formBlocIds()) states[id] = { colorOverride: SELECTED_COLOR, selected: true };
    } else {
      const highlighted = this.highlightedCloseId();
      for (const c of this.closes()) {
        const color = c.id === highlighted ? SELECTED_COLOR : TAKEN_COLOR;
        for (const b of c.blocIds) states[b] = { colorOverride: color };
      }
    }
    return { 'closes-blocs': states };
  });

  /** Cadrage sur l'union des blocs sélectionnés — c'est la seule « union » qu'on calcule, et elle est visuelle. */
  protected readonly mapFitBbox = computed(() => {
    const ids = this.editing() !== null
      ? this.formBlocIds()
      : (this.closes().find((c) => c.id === this.highlightedCloseId())?.blocIds ?? []);
    if (ids.length === 0) return null;
    const blocs = this.blocs().filter((b) => ids.includes(b.id));
    return unionBounds(blocs.map((b) => (b.boundaryWkt ? wktBounds(b.boundaryWkt) : null)));
  });

  protected readonly isBlocTaken = computed(() => {
    const owner = this.blocOwner();
    const selfId = this.editing();
    return (blocId: UUID) => {
      const c = owner.get(blocId);
      return !!c && c.id !== selfId;
    };
  });

  protected readonly canSave = computed(() =>
    this.formName().trim().length > 0
    && this.formNumber() !== null
    && this.formNumber()! > 0
    && this.formBlocIds().length > 0
    && this.quartierId() !== null
    && this.numberCollision() === null,
  );

  onHierarchy(sel: HierarchySelection): void {
    this.cancelEdit();
    this.facade.selectQuartier(sel.quartierId);
  }

  highlight(id: UUID | null): void { this.highlightedCloseId.set(id); }

  startCreate(): void {
    this.editing.set('new');
    this.formName.set('');
    this.formNumber.set(null);
    this.formBlocIds.set([]);
  }

  startEdit(c: Close): void {
    this.editing.set(c.id);
    this.formName.set(c.name);
    this.formNumber.set(c.number);
    this.formBlocIds.set([...c.blocIds]);
  }

  cancelEdit(): void { this.editing.set(null); }

  /** Point d'entrée unique du clic carte ET de la case à cocher — les deux modes restent synchronisés par construction. */
  toggleBloc(blocId: UUID): void {
    if (this.editing() === null || this.isBlocTaken()(blocId)) return;
    this.formBlocIds.update((ids) => (ids.includes(blocId) ? ids.filter((x) => x !== blocId) : [...ids, blocId]));
  }

  isSelected(blocId: UUID): boolean { return this.formBlocIds().includes(blocId); }

  save(): void {
    if (!this.canSave()) return;
    const id = this.editing();
    this.facade.save(
      id === 'new' ? null : id,
      { name: this.formName().trim(), number: this.formNumber()!, quartierId: this.quartierId()!, blocIds: this.formBlocIds() },
    );
    // Pas de cancelEdit() ici : la fermeture est pilotée par `saveTick` (constructeur), donc
    // seulement en cas de succès.
  }

  remove(c: Close): void {
    if (this.saving()) return;
    this.facade.remove(c.id);
  }
}
