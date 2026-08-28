import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
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
  private readonly _closes = signal<HierarchyNode[]>([]);
  private readonly _allBlocs = signal<HierarchyNode[]>([]);
  private readonly _selection = signal<HierarchySelection>(EMPTY_HIERARCHY_SELECTION);

  readonly cities = this._cities.asReadonly();
  readonly communes = this._communes.asReadonly();
  readonly zones = this._zones.asReadonly();
  readonly quartiers = this._quartiers.asReadonly();
  readonly closes = this._closes.asReadonly();
  readonly selection = this._selection.asReadonly();

  /**
   * Blocs du quartier, restreints à la close choisie quand il y en a une.
   * Le filtrage est **front** : le back n'expose que `GET /api/blocs?quartierId=`.
   */
  readonly blocs = computed(() => {
    const closeId = this._selection().closeId;
    const all = this._allBlocs();
    return closeId ? all.filter((b) => b.closeId === closeId) : all;
  });

  /** bbox du niveau non-null le plus profond — pour le fitBounds. */
  readonly selectedBbox = computed<Bbox4326 | null>(() => {
    const s = this._selection();
    const bboxOf = (list: HierarchyNode[], id: UUID | null) =>
      id ? (list.find((n) => n.id === id)?.bbox ?? null) : null;
    return bboxOf(this._closes(), s.closeId)
      ?? bboxOf(this._quartiers(), s.quartierId)
      ?? this.zonesBbox(s.zoneIds)
      ?? bboxOf(this._communes(), s.communeId)
      ?? bboxOf(this._cities(), s.cityId);
  });

  /** Repart d'un état propre puis charge les villes. Appelé au montage de chaque cascade. */
  loadRoot(): void {
    this._selection.set(EMPTY_HIERARCHY_SELECTION);
    this._communes.set([]); this._zones.set([]); this._quartiers.set([]);
    this._closes.set([]); this._allBlocs.set([]);
    this.api.cities().subscribe((c) => this._cities.set(c));
  }

  selectCity(cityId: UUID | null): void {
    this._selection.set({ cityId, communeId: null, zoneIds: [], zoneId: null, quartierId: null, closeId: null });
    this._communes.set([]); this._zones.set([]); this._quartiers.set([]);
    this._closes.set([]); this._allBlocs.set([]);
    if (cityId) {
      this.api.communes(cityId).subscribe((c) => this._communes.set(c));
      // Les zones de la ville entiere, sans attendre qu'une commune soit choisie.
      this.api.zones(cityId).subscribe((z) => this._zones.set(z));
    }
    this.reloadQuartiers();
  }

  /**
   * Revenir a « toutes les communes » RECHARGE les zones de la ville au lieu de les vider :
   * une ville a des zones meme quand aucune commune n'est choisie, et les effacer laissait un
   * select desactive alors qu'il y avait tout a montrer.
   */
  selectCommune(communeId: UUID | null): void {
    this._selection.update((s) => ({ ...s, communeId, zoneIds: [], zoneId: null, quartierId: null, closeId: null }));
    this._zones.set([]); this._closes.set([]); this._allBlocs.set([]);
    const { cityId } = this._selection();
    if (cityId) this.api.zones(cityId, communeId).subscribe((z) => this._zones.set(z));
    this.reloadQuartiers();
  }

  /**
   * Coche / décoche une zone. Le filtre est cumulatif : plusieurs zones peuvent être actives.
   * Liste vide = « toutes les zones », comme `null` aux autres niveaux.
   */
  toggleZone(zoneId: UUID): void {
    this._selection.update((s) => {
      const zoneIds = s.zoneIds.includes(zoneId)
        ? s.zoneIds.filter((z) => z !== zoneId)
        : [...s.zoneIds, zoneId];
      return { ...s, zoneIds, zoneId: zoneIds.length === 1 ? zoneIds[0] : null, quartierId: null, closeId: null };
    });
    this._closes.set([]); this._allBlocs.set([]);
    this.reloadQuartiers();
  }

  clearZones(): void {
    this._selection.update((s) => ({ ...s, zoneIds: [], zoneId: null, quartierId: null, closeId: null }));
    this._closes.set([]); this._allBlocs.set([]);
    this.reloadQuartiers();
  }

  /** Emprise couvrant toutes les zones cochées. */
  private zonesBbox(zoneIds: UUID[]): Bbox4326 | null {
    const boxes = this._zones().filter((z) => zoneIds.includes(z.id)).map((z) => z.bbox).filter((b): b is Bbox4326 => !!b);
    if (boxes.length === 0) return null;
    return boxes.reduce<Bbox4326>((acc, b) => [
      Math.min(acc[0], b[0]), Math.min(acc[1], b[1]),
      Math.max(acc[2], b[2]), Math.max(acc[3], b[3]),
    ], boxes[0]);
  }

  /**
   * Quartiers de la ville sélectionnée, affinés par commune/zone si choisies.
   * Commune et Zone sont facultatives (une ville sans commune n'a pas de zone) : en mode
   * « tous » sur les deux, seul `cityId` part au back — pas de select quartier bloqué.
   */
  private reloadQuartiers(): void {
    const { cityId, communeId, zoneIds } = this._selection();
    if (!cityId) { this._quartiers.set([]); return; }

    // Plusieurs zones cochées : `GET /api/quartiers?zoneId=` n'en prend qu'une, donc un appel
    // par zone puis fusion. On interroge le back plutôt que de deviner la zone d'un quartier
    // côté front — `HierarchyNode` n'expose pas le rattachement, seulement `parentId`.
    const requetes = zoneIds.length > 1
      ? forkJoin(zoneIds.map((z) => this.api.quartiers(cityId, communeId, z)))
      : of([]);

    if (zoneIds.length > 1) {
      requetes.subscribe((listes) => {
        const vus = new Map<UUID, HierarchyNode>();
        for (const liste of listes) for (const q of liste) vus.set(q.id, q);
        this._quartiers.set([...vus.values()].sort((a, b) => a.name.localeCompare(b.name)));
      });
      return;
    }
    this.api.quartiers(cityId, communeId, zoneIds[0] ?? null).subscribe((q) => this._quartiers.set(q));
  }

  /** Charge closes ET blocs du quartier : la close n'est qu'un filtre du même jeu de blocs. */
  selectQuartier(quartierId: UUID | null): void {
    this._selection.update((s) => ({ ...s, quartierId, closeId: null }));
    this._closes.set([]); this._allBlocs.set([]);
    if (!quartierId) return;
    this.api.closes(quartierId).subscribe((c) => this._closes.set(c));
    this.api.blocs(quartierId).subscribe((b) => this._allBlocs.set(b));
  }

  /** Raffinement : aucun rechargement, `blocs` se restreint tout seul (computed). */
  selectClose(closeId: UUID | null): void {
    this._selection.update((s) => ({ ...s, closeId }));
  }
}
