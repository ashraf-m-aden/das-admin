import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { PostcodesFacade } from '../../core/postcodes/store/postcodes.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { unionBounds, wktBounds, wktPolygon } from '../../core/ui/map/wkt.util';
import { AuthFacade } from '../../core/auth/store/auth.facade';
import { UUID, UserRole } from '../../core/models/das.models';
import { CityPostcodeRow, QuartierPostcodeRow, ZoneRow } from '../../core/postcodes/models/postcodes.models';

const CAN_EDIT_ROLES: UserRole[] = ['Admin', 'Gestionnaire'];

/** Quartier explicitement sélectionné dans la liste des codes postaux. */
const HIGHLIGHT_COLOR = '#2563eb';
/**
 * Quartier DÉSIGNÉ, par un clic sur sa ligne ou sur la carte. Volontairement distinct du bleu
 * de surbrillance des codes postaux : les deux notions se superposent — on peut désigner un
 * quartier qui fait partie de la sélection de codes — et doivent rester distinguables.
 */
const FOCUS_COLOR = '#dc2626';
/** Quartier sans code postal calculable : le vide est une information, il doit se voir. */
const NO_POSTCODE_COLOR = '#dfe3ea';
/** Palette de fond par zone — lisible seulement quand aucun code postal n'est sélectionné. */
const ZONE_PALETTE = ['#16a34a', '#d97706', '#7c3aed', '#0d9488', '#db2777', '#65a30d'];

@Component({
  selector: 'das-postcodes',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './postcodes.component.html',
  styleUrl: './postcodes.component.scss',
})
export class PostcodesComponent implements OnInit {
  protected facade = inject(PostcodesFacade);
  private authFacade = inject(AuthFacade);

  private readonly roles = toSignal(this.authFacade.roles$, { initialValue: [] as UserRole[] });
  protected readonly canEdit = computed(() => this.roles().some((r) => CAN_EDIT_ROLES.includes(r)));

  protected readonly filterCityId = signal<UUID | null>(null);
  protected readonly onlyMissing = signal(false);

  /* ---- Carte --------------------------------------------------------------- */

  /** Codes postaux mis en évidence. Vide = coloriage par zone, qui donne la structure d'ensemble. */
  protected readonly highlighted = signal<string[]>([]);

  /**
   * Quartier désigné. Un seul, alimenté par les DEUX sens : clic sur une ligne du tableau, ou
   * clic sur la carte. C'est lui qui commande le cadrage.
   */
  protected readonly selectedQuartierId = signal<UUID | null>(null);

  /**
   * Vrai quand la désignation vient de la CARTE. Le tableau ne se réduit alors qu'à ce quartier.
   *
   * Deux drapeaux plutôt qu'un, parce que les deux gestes n'attendent pas la même chose : cliquer
   * une ligne demande à voir OÙ elle est, sans perdre le reste de la liste ; cliquer la carte
   * demande à savoir CE QUE c'est, donc à isoler la ligne. Un seul drapeau ferait disparaître la
   * liste sous le doigt de qui vient d'y cliquer.
   */
  protected readonly filterFromMap = signal(false);

  /** Clic sur une ligne : on désigne, on cadre, on ne touche pas au filtrage de la liste. */
  focusQuartier(id: UUID): void {
    const same = this.selectedQuartierId() === id && !this.filterFromMap();
    this.selectedQuartierId.set(same ? null : id);
    this.filterFromMap.set(false);
  }

  clearQuartierSelection(): void {
    this.selectedQuartierId.set(null);
    this.filterFromMap.set(false);
  }

  /** Le quartier désigné, pour l'afficher dans la bannière de filtrage. */
  protected readonly selectedQuartier = computed(() =>
    this.facade.quartiers().find((q) => q.id === this.selectedQuartierId()) ?? null);
  protected readonly postcodeSearch = signal('');

  /** Codes postaux réellement calculables, dédoublonnés et triés — c'est ce qu'on peut surligner. */
  protected readonly availablePostcodes = computed(() => {
    const term = this.postcodeSearch().trim().toLowerCase();
    const seen = new Map<string, string>();
    for (const q of this.facade.quartiers()) {
      if (q.postcode) seen.set(q.postcode, q.nom);
    }
    return [...seen.entries()]
      .filter(([code, nom]) => !term || code.includes(term) || nom.toLowerCase().includes(term))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, nom]) => ({ code, nom }));
  });

  isHighlighted(code: string): boolean { return this.highlighted().includes(code); }

  toggleHighlight(code: string): void {
    this.highlighted.update((c) => c.includes(code) ? c.filter((x) => x !== code) : [...c, code]);
  }

  clearHighlight(): void { this.highlighted.set([]); }

  private zoneColor(zoneId: string | null): string {
    if (!zoneId) return NO_POSTCODE_COLOR;
    const zones = this.facade.zones();
    const i = zones.findIndex((z) => z.id === zoneId);
    return ZONE_PALETTE[(i < 0 ? 0 : i) % ZONE_PALETTE.length];
  }

  protected readonly zoneLegend = computed(() =>
    this.facade.zones().map((z, i) => ({ ...z, color: ZONE_PALETTE[i % ZONE_PALETTE.length] })));

  /**
   * Un polygone par quartier, étiqueté de son code postal. La géométrie vient de l'API et non
   * des tuiles : le code postal est DÉRIVÉ, donc aucune tuile ne le porte — seule la réponse
   * de `/api/quartiers` sait le calculer.
   *
   * Sélection active → seuls les codes choisis sont colorés, le reste passe en gris ; c'est ce
   * contraste qui fait la mise en évidence. Sans sélection, on colore par zone.
   */
  protected readonly mapFeatures = computed<MapFeature[]>(() => {
    const picked = this.highlighted();
    return this.facade.quartiers().flatMap((q) => {
      if (!q.boundaryWkt) return [];
      const geometry = wktPolygon(q.boundaryWkt);
      if (!geometry) return [];
      // Le quartier désigné prime sur tout le reste : c'est la réponse au clic qu'on vient de
      // faire, elle doit se voir même sur un quartier sans code postal.
      const color = q.id === this.selectedQuartierId() ? FOCUS_COLOR
        : !q.postcode ? NO_POSTCODE_COLOR
          : picked.length > 0 ? (this.isHighlighted(q.postcode) ? HIGHLIGHT_COLOR : NO_POSTCODE_COLOR)
            : this.zoneColor(q.zoneId);
      return [{
        id: q.id, layerId: 'quartiers', geometry, color,
        label: q.postcode ?? '', selectable: true,
      }];
    });
  });

  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'quartiers', labelKey: 'nav.postcodes', type: 'fill', visible: true, showLabels: true },
  ];

  /** Cadrage sur les quartiers surlignés — sinon sur l'ensemble, via `fitToData` de la carte. */
  protected readonly mapFitBbox = computed(() => {
    // Le quartier désigné passe devant : c'est le geste le plus récent de l'utilisateur.
    const sel = this.selectedQuartier();
    if (sel?.boundaryWkt) return wktBounds(sel.boundaryWkt);

    const picked = this.highlighted();
    if (picked.length === 0) return null;
    const boxes = this.facade.quartiers()
      .filter((q) => q.postcode && picked.includes(q.postcode) && q.boundaryWkt)
      .map((q) => wktBounds(q.boundaryWkt!));
    return unionBounds(boxes);
  });

  /**
   * Clic sur un quartier de la carte : on le désigne et on réduit la liste à lui.
   *
   * Remplace l'ancien comportement, qui basculait son code postal dans la surbrillance : ce
   * geste-là reste disponible dans la liste cochable au-dessus de la carte, et il ne répondait
   * pas à la question qu'on se pose en cliquant une forme — « c'est lequel, celui-là ? ».
   */
  onMapQuartier(id: string): void {
    const same = this.selectedQuartierId() === id && this.filterFromMap();
    this.selectedQuartierId.set(same ? null : id);
    this.filterFromMap.set(!same);
  }

  protected readonly filteredQuartiers = computed(() => {
    // Désignation venue de la carte : elle court-circuite les autres filtres. Les combiner
    // pourrait rendre une liste vide — « j'ai cliqué un quartier et il a disparu ».
    const fromMap = this.filterFromMap() ? this.selectedQuartierId() : null;
    if (fromMap) return this.facade.quartiers().filter((q) => q.id === fromMap);

    return this.facade.quartiers().filter((q) =>
      (!this.filterCityId() || q.cityId === this.filterCityId())
      && (!this.onlyMissing() || q.postcode === null));
  });

  protected readonly editingQuartierId = signal<UUID | null>(null);
  protected readonly editAreaNumber = signal<number | null>(null);

  protected readonly editingCityId = signal<UUID | null>(null);
  protected readonly editCityCode = signal<number | null>(null);
  protected readonly confirmingCityId = signal<UUID | null>(null);

  ngOnInit(): void { this.facade.load(); }

  setCityFilter(id: string): void { this.filterCityId.set(id || null); }
  toggleOnlyMissing(): void { this.onlyMissing.update((v) => !v); }

  startEditArea(row: QuartierPostcodeRow): void {
    this.editingQuartierId.set(row.id);
    this.editAreaNumber.set(row.areaNumber);
  }
  cancelEditArea(): void { this.editingQuartierId.set(null); }
  saveEditArea(row: QuartierPostcodeRow): void {
    const value = this.editAreaNumber();
    if (value === null || value < 1 || value > 999) return;
    this.facade.updateAreaNumber(row, value);
    this.editingQuartierId.set(null);
  }

  startEditCity(row: CityPostcodeRow): void {
    this.editingCityId.set(row.id);
    this.editCityCode.set(row.code);
    this.confirmingCityId.set(null);
  }
  cancelEditCity(): void { this.editingCityId.set(null); this.confirmingCityId.set(null); }
  requestSaveCity(row: CityPostcodeRow): void {
    const value = this.editCityCode();
    if (value === null || value < 1 || value > 99) return;
    // Changer le code d'une ville recalcule le code postal de tous ses quartiers : on ne l'applique
    // qu'après une confirmation explicite plutôt que de laisser découvrir l'effet après coup.
    this.confirmingCityId.set(row.id);
  }
  confirmSaveCity(row: CityPostcodeRow): void {
    const value = this.editCityCode();
    if (value === null) return;
    this.facade.updateCityCode(row, value);
    this.editingCityId.set(null);
    this.confirmingCityId.set(null);
  }

  quartierCountForCity(cityId: UUID): number {
    return this.facade.quartiers().filter((q) => q.cityId === cityId).length;
  }

  /* ---- Colonne Zone de la liste des quartiers ------------------------------ */

  zonesFor(q: QuartierPostcodeRow) { return this.facade.zonesForQuartier(q.communeId); }

  zoneNameOf(q: QuartierPostcodeRow): string {
    return this.facade.zones().find((z) => z.id === q.zoneId)?.name ?? '—';
  }

  /**
   * Le choix s'applique immédiatement, sans étape de confirmation : rattacher un quartier est
   * réversible d'un seul geste — il suffit de reprendre la valeur précédente dans la même
   * liste. Une confirmation coûterait un clic à chaque ligne sans rien protéger.
   */
  onZoneChange(q: QuartierPostcodeRow, zoneId: string): void {
    const next = zoneId || null;
    if (next === q.zoneId) return;
    this.facade.assignZone(q, next);
  }

  /* ---- Section Zones (masquée) ---------------------------------------------
   * Le bloc dépliable de gestion des zones est commenté dans le gabarit : la colonne Zone de
   * la liste des quartiers suffit pour l'instant. Ce qui suit reste en place pour que le
   * rétablir soit un simple décommentage, sans avoir à réécrire l'état.
   * ------------------------------------------------------------------------- */

  /** Zone dépliée : la composition n'a d'intérêt qu'une zone à la fois, sinon la page double de long. */
  protected readonly expandedZoneId = signal<UUID | null>(null);
  protected readonly addingZoneId = signal<UUID | null>(null);
  protected readonly quartierToAdd = signal<UUID | null>(null);
  protected readonly detachingQuartierId = signal<UUID | null>(null);

  toggleZone(zone: ZoneRow): void {
    const open = this.expandedZoneId() === zone.id;
    this.expandedZoneId.set(open ? null : zone.id);
    if (open) this.cancelAddQuartier();
  }

  isZoneExpanded(zone: ZoneRow): boolean { return this.expandedZoneId() === zone.id; }

  eligibleFor(zone: ZoneRow) { return this.facade.eligibleQuartiers(zone); }

  startAddQuartier(zone: ZoneRow): void {
    this.expandedZoneId.set(zone.id);
    this.addingZoneId.set(zone.id);
    this.quartierToAdd.set(null);
  }

  cancelAddQuartier(): void { this.addingZoneId.set(null); this.quartierToAdd.set(null); }

  confirmAddQuartier(zone: ZoneRow): void {
    const id = this.quartierToAdd();
    const quartier = this.facade.quartiers().find((q) => q.id === id);
    if (!quartier) return;
    this.facade.assignZone(quartier, zone.id);
    this.cancelAddQuartier();
  }

  /**
   * Détacher demande une confirmation : le geste est discret à l'écran mais il retire le
   * quartier du regroupement qui colorie la carte, et rien ne le signale ensuite.
   */
  requestDetach(q: QuartierPostcodeRow): void { this.detachingQuartierId.set(q.id); }
  cancelDetach(): void { this.detachingQuartierId.set(null); }
  confirmDetach(q: QuartierPostcodeRow): void {
    this.facade.assignZone(q, null);
    this.detachingQuartierId.set(null);
  }
}
