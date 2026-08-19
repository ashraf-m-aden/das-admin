import { Injectable, computed, inject, signal } from '@angular/core';
import { HierarchyApiPort } from '../services/hierarchy-api.port';
import { UUID } from '../../models/das.models';
import { Bbox4326, EMPTY_HIERARCHY_SELECTION, HierarchyNode, HierarchySelection } from '../models/hierarchy.models';

@Injectable({ providedIn: 'root' })
export class HierarchyFacade {
  private api = inject(HierarchyApiPort);

  private readonly _cities = signal<HierarchyNode[]>([]);
  private readonly _communes = signal<HierarchyNode[]>([]);
  private readonly _zones = signal<HierarchyNode[]>([]);
  private readonly _quartiers = signal<HierarchyNode[]>([]);
  private readonly _blocs = signal<HierarchyNode[]>([]);
  private readonly _selection = signal<HierarchySelection>(EMPTY_HIERARCHY_SELECTION);

  readonly cities = this._cities.asReadonly();
  readonly communes = this._communes.asReadonly();
  readonly zones = this._zones.asReadonly();
  readonly quartiers = this._quartiers.asReadonly();
  readonly blocs = this._blocs.asReadonly();
  readonly selection = this._selection.asReadonly();

  /** bbox du niveau non-null le plus profond — pour le fitBounds. */
  readonly selectedBbox = computed<Bbox4326 | null>(() => {
    const s = this._selection();
    const bboxOf = (list: HierarchyNode[], id: UUID | null) =>
      id ? (list.find((n) => n.id === id)?.bbox ?? null) : null;
    return bboxOf(this._blocs(), s.blocId)
      ?? bboxOf(this._quartiers(), s.quartierId)
      ?? bboxOf(this._zones(), s.zoneId)
      ?? bboxOf(this._communes(), s.communeId)
      ?? bboxOf(this._cities(), s.cityId);
  });

  /** Repart d'un état propre puis charge les villes. Appelé au montage de chaque cascade. */
  loadRoot(): void {
    this._selection.set(EMPTY_HIERARCHY_SELECTION);
    this._communes.set([]); this._zones.set([]); this._quartiers.set([]); this._blocs.set([]);
    this.api.cities().subscribe((c) => this._cities.set(c));
  }

  selectCity(cityId: UUID | null): void {
    this._selection.set({ cityId, communeId: null, zoneId: null, quartierId: null, blocId: null });
    this._communes.set([]); this._zones.set([]); this._quartiers.set([]); this._blocs.set([]);
    if (cityId) this.api.communes(cityId).subscribe((c) => this._communes.set(c));
    this.reloadQuartiers();
  }

  selectCommune(communeId: UUID | null): void {
    this._selection.update((s) => ({ ...s, communeId, zoneId: null, quartierId: null, blocId: null }));
    this._zones.set([]); this._blocs.set([]);
    if (communeId) this.api.zones(communeId).subscribe((z) => this._zones.set(z));
    this.reloadQuartiers();
  }

  selectZone(zoneId: UUID | null): void {
    this._selection.update((s) => ({ ...s, zoneId, quartierId: null, blocId: null }));
    this._blocs.set([]);
    this.reloadQuartiers();
  }

  /**
   * Quartiers de la ville sélectionnée, affinés par commune/zone si choisies.
   * Commune et Zone sont facultatives (une ville sans commune n'a pas de zone) : en mode
   * « tous » sur les deux, seul `cityId` part au back — pas de select quartier bloqué.
   */
  private reloadQuartiers(): void {
    const { cityId, communeId, zoneId } = this._selection();
    if (!cityId) { this._quartiers.set([]); return; }
    this.api.quartiers(cityId, communeId, zoneId).subscribe((q) => this._quartiers.set(q));
  }

  selectQuartier(quartierId: UUID | null): void {
    this._selection.update((s) => ({ ...s, quartierId, blocId: null }));
    this._blocs.set([]);
    if (quartierId) this.api.blocs(quartierId).subscribe((b) => this._blocs.set(b));
  }

  selectBloc(blocId: UUID | null): void {
    this._selection.update((s) => ({ ...s, blocId }));
  }
}
