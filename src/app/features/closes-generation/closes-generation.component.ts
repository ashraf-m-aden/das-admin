import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { CloseGenerationFacade } from '../../core/closes/store/close-generation.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { unionBounds, wktBounds, wktPolygon } from '../../core/ui/map/wkt.util';
import {
  STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
} from '../../core/ui/map/basemap-groups';
import { ProposedClose, QuartierCloseProgress } from '../../core/closes/models/closes.models';
import { UUID } from '../../core/models/das.models';
import { CloseProposalRowComponent } from './close-proposal-row/close-proposal-row.component';
import { CloseNumberingPanelComponent } from './close-numbering-panel/close-numbering-panel.component';

/**
 * Une proposition retenue, une proposition qui dépasse le plafond de 99 adresses, et un bloc que
 * l'appariement n'a pas su rattacher. Trois couleurs, trois sens — pas de dégradé : sur une carte
 * de relecture, une nuance se lit mal et se discute.
 */
const PROPOSAL_COLOR = '#2563eb';
const OVER_CAP_COLOR = '#d97706';
const UNASSIGNED_COLOR = '#9aa3b5';

const LAYERS: MapLayerConfig[] = [
  { id: 'proposals', labelKey: 'closes.generation.layerProposals', type: 'fill', visible: true },
  // Visible par défaut, et c'est délibéré : 42 % des blocs n'ont aucune voirie urbaine à moins de
  // 50 m. Masquer ces blocs laisserait croire que le quartier a été traité en entier.
  { id: 'unassigned', labelKey: 'closes.generation.layerUnassigned', type: 'fill', visible: true },
];

/**
 * Écran de génération des closes d'un quartier.
 *
 * ⚠️ **Sans confirmation.** Aucune écriture n'est possible depuis cet écran tant que la règle du
 * plafond de 99 adresses par close n'est pas tranchée — elle entre en conflit avec l'index unique
 * (quartier, rue), qui interdit de découper une rue desservant plus de 99 adresses. Les trois
 * routes appelées ici n'écrivent rien. `blockers` calcule déjà ce qui empêcherait de confirmer,
 * pour que l'écran le dise maintenant plutôt qu'au moment d'écrire.
 * Voir `docs/plans/generation-closes.md`.
 */
@Component({
  selector: 'das-closes-generation',
  standalone: true,
  imports: [
    AsyncPipe, DecimalPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent,
    CloseProposalRowComponent, CloseNumberingPanelComponent,
  ],
  templateUrl: './closes-generation.component.html',
  styleUrl: './closes-generation.component.scss',
})
export class ClosesGenerationComponent implements OnInit {
  private facade = inject(CloseGenerationFacade);

  protected readonly basemapLayers = [
    STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
  ];
  protected readonly mapLayers = LAYERS;

  protected readonly progress = toSignal(this.facade.progress$, { initialValue: [] });
  protected readonly isProgressLoading = toSignal(this.facade.isProgressLoading$, { initialValue: false });
  protected readonly quartierId = toSignal(this.facade.quartierId$, { initialValue: null });
  protected readonly plan = toSignal(this.facade.plan$, { initialValue: null });
  protected readonly isPreviewing = toSignal(this.facade.isPreviewing$, { initialValue: false });
  protected readonly proposals = toSignal(this.facade.proposals$, { initialValue: [] as ProposedClose[] });
  protected readonly discarded = toSignal(this.facade.discardedProposals$, { initialValue: [] as ProposedClose[] });
  protected readonly summary = toSignal(this.facade.summary$, { initialValue: null });
  protected readonly blockers = toSignal(this.facade.blockers$, { initialValue: [] as string[] });
  protected readonly reviewedKeys = toSignal(this.facade.reviewedKeys$, { initialValue: [] as string[] });
  protected readonly streets = toSignal(this.facade.streets$, { initialValue: [] });
  protected readonly numberingKey = toSignal(this.facade.numberingKey$, { initialValue: null });
  protected readonly errorMessageKey = toSignal(this.facade.errorMessageKey$, { initialValue: null });

  /** Filtre de la liste des quartiers. Sur 87 lignes, chercher au clavier bat le défilement. */
  protected readonly search = signal('');
  /** Repli du panneau des réglages : ils ont des défauts sensés, on ne les ouvre que pour les changer. */
  protected readonly showParameters = signal(false);
  protected readonly maxDistanceMeters = signal(50);
  protected readonly selectedProposalKey = signal<string | null>(null);

  protected readonly filteredProgress = computed<QuartierCloseProgress[]>(() => {
    const needle = this.search().trim().toLowerCase();
    const rows = this.progress();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.quartierNom.toLowerCase().includes(needle)
      || r.quartierCode.toLowerCase().includes(needle)
      || (r.cityName ?? '').toLowerCase().includes(needle));
  });

  /** Propositions et blocs non rattachés dessinés ensemble : c'est la comparaison qui informe. */
  protected readonly features = computed<MapFeature[]>(() => {
    const out: MapFeature[] = [];
    for (const p of this.proposals()) {
      const geometry = p.boundaryWkt ? wktPolygon(p.boundaryWkt) : null;
      if (!geometry) continue;
      out.push({
        id: p.key,
        layerId: 'proposals',
        geometry,
        color: p.warnings.includes('ExceedsAddressCap') ? OVER_CAP_COLOR : PROPOSAL_COLOR,
        label: `${p.code} — ${p.streetName ?? p.streetCode}`,
      });
    }
    for (const b of this.plan()?.unassignedBlocs ?? []) {
      const geometry = b.boundaryWkt ? wktPolygon(b.boundaryWkt) : null;
      if (!geometry) continue;
      out.push({
        id: `u-${b.blocId}`,
        layerId: 'unassigned',
        geometry,
        color: UNASSIGNED_COLOR,
        label: b.blocCode,
        selectable: false,
      });
    }
    return out;
  });

  /** Cadrage sur ce que le plan couvre, propositions et non-rattachés confondus. */
  protected readonly fitBbox = computed<[number, number, number, number] | null>(() => {
    const wkts = [
      ...this.proposals().map((p) => p.boundaryWkt),
      ...(this.plan()?.unassignedBlocs ?? []).map((b) => b.boundaryWkt),
    ].filter((w): w is string => !!w);
    return unionBounds(wkts.map((w) => wktBounds(w)));
  });

  ngOnInit(): void {
    this.facade.loadProgress();
    this.facade.loadStreets();
  }

  protected selectQuartier(row: QuartierCloseProgress): void {
    this.selectedProposalKey.set(null);
    this.facade.selectQuartier(row.quartierId);
  }

  protected applyParameters(): void {
    this.facade.setParameters({ maxDistanceMeters: this.maxDistanceMeters() });
  }

  protected onFeatureSelect(id: string): void {
    // Les blocs non rattachés ne sont pas sélectionnables : seule une proposition remonte ici.
    this.selectedProposalKey.set(id);
  }

  protected isReviewed(key: string): boolean {
    return this.reviewedKeys().includes(key);
  }

  protected trackByKey = (_: number, p: ProposedClose): string => p.key;
  protected trackByQuartier = (_: number, r: QuartierCloseProgress): UUID => r.quartierId;
}
