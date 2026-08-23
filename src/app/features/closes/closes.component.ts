import { Component, computed, inject, signal } from '@angular/core';
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
import { UUID, UserRole } from '../../core/models/das.models';

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
  imports: [FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent, HierarchyCascadeComponent],
  templateUrl: './closes.component.html',
  styleUrl: './closes.component.scss',
})
export class ClosesComponent {
  protected facade = inject(ClosesFacade);
  private authFacade = inject(AuthFacade);

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  protected readonly quartierId = signal<UUID | null>(null);

  /** `null` = aucun formulaire ouvert ; `'new'` = création ; sinon l'id de la close éditée. */
  protected readonly editing = signal<UUID | 'new' | null>(null);
  protected readonly formName = signal('');
  protected readonly formNumber = signal<number | null>(null);
  protected readonly formBlocIds = signal<UUID[]>([]);

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
    const owner = this.facade.blocOwner();
    const selfId = this.editing();

    if (selfId !== null) {
      for (const [blocId, close] of owner) {
        if (close.id !== selfId) states[blocId] = { colorOverride: TAKEN_COLOR };
      }
      for (const id of this.formBlocIds()) states[id] = { colorOverride: SELECTED_COLOR, selected: true };
    } else {
      const highlighted = this.highlightedCloseId();
      for (const c of this.facade.closes()) {
        const color = c.id === highlighted ? SELECTED_COLOR : TAKEN_COLOR;
        for (const b of c.blocIds) states[b] = { colorOverride: color };
      }
    }
    return { 'closes-blocs': states };
  });

  protected readonly highlightedCloseId = signal<UUID | null>(null);

  /** Cadrage sur l'union des blocs sélectionnés — c'est la seule « union » qu'on calcule, et elle est visuelle. */
  protected readonly mapFitBbox = computed(() => {
    const ids = this.editing() !== null
      ? this.formBlocIds()
      : (this.facade.closes().find((c) => c.id === this.highlightedCloseId())?.blocIds ?? []);
    if (ids.length === 0) return null;
    const blocs = this.facade.blocs().filter((b) => ids.includes(b.id));
    return unionBounds(blocs.map((b) => (b.boundaryWkt ? wktBounds(b.boundaryWkt) : null)));
  });

  protected readonly isBlocTaken = computed(() => {
    const owner = this.facade.blocOwner();
    const selfId = this.editing();
    return (blocId: UUID) => {
      const c = owner.get(blocId);
      return !!c && c.id !== selfId;
    };
  });

  onHierarchy(sel: HierarchySelection): void {
    this.quartierId.set(sel.quartierId);
    this.cancelEdit();
    this.facade.load(sel.quartierId);
    this.facade.loadBlocs(sel.quartierId);
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

  protected readonly canSave = computed(() =>
    this.formName().trim().length > 0
    && this.formNumber() !== null
    && this.formNumber()! > 0
    && this.formBlocIds().length > 0
    && this.quartierId() !== null,
  );

  save(): void {
    if (!this.canSave()) return;
    const id = this.editing();
    this.facade.save(
      id === 'new' ? null : id,
      { name: this.formName().trim(), number: this.formNumber()!, quartierId: this.quartierId()!, blocIds: this.formBlocIds() },
      () => this.cancelEdit(),
    );
  }

  remove(c: Close): void { this.facade.remove(c.id, this.quartierId()); }

  blocLabel(blocId: UUID): string {
    const b = this.facade.blocs().find((x) => x.id === blocId);
    return b ? (b.name ?? b.code) : blocId;
  }
}
