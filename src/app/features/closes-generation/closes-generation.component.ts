import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CloseGenerationFacade } from '../../core/closes/store/close-generation.facade';
import { initialBulkState, PARAMETRES_PAR_DEFAUT } from '../../core/closes/store/close-generation.state';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { unionBounds, wktBounds, wktPolygon } from '../../core/ui/map/wkt.util';
import {
  STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, QUARTIERS_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
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
 * Écran de génération des closes.
 *
 * <b>Deux façons d'écrire, et elles n'ont pas le même prix.</b>
 *
 * 1. <b>Par quartier</b> — on relit le plan à l'écran, on corrige, on ouvre les plans de
 *    numérotation, puis on confirme. C'est la voie normale.
 * 2. <b>Confirmation générale</b> — on recense tous les quartiers restants, puis on écrit d'un
 *    seul geste. Va vite, et accepte les numéros que le serveur propose sans que personne les
 *    relise.
 *
 * ⚠️ <b>La confirmation générale n'a PAS de transaction globale.</b> Le back n'expose qu'une
 * route par quartier : un échec au douzième laisse les onze premiers écrits, et les closes ne se
 * défont pas depuis cet écran.
 *
 * `blockers` calcule ce qui empêcherait de confirmer un quartier, pour que l'écran le dise avant
 * plutôt qu'au moment d'écrire. Voir `docs/plans/generation-closes.md`.
 */
@Component({
  selector: 'das-closes-generation',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, TranslocoModule, PageHeaderComponent, DasMapComponent,
    CloseProposalRowComponent, CloseNumberingPanelComponent,
  ],
  templateUrl: './closes-generation.component.html',
  styleUrl: './closes-generation.component.scss',
})
export class ClosesGenerationComponent implements OnInit {
  private facade = inject(CloseGenerationFacade);

  protected readonly basemapLayers = [
    STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, ZONES_BASEMAP_GROUP, QUARTIERS_BASEMAP_GROUP, POSTCODES_BASEMAP_GROUP,
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
  private readonly transloco = inject(TranslocoService);

  protected readonly isApplying = toSignal(this.facade.isApplying$, { initialValue: false });
  protected readonly applied = toSignal(this.facade.applied$, { initialValue: null });
  protected readonly reviewedKeys = toSignal(this.facade.reviewedKeys$, { initialValue: [] as string[] });
  protected readonly streets = toSignal(this.facade.streets$, { initialValue: [] });
  protected readonly numberingKey = toSignal(this.facade.numberingKey$, { initialValue: null });
  protected readonly errorMessageKey = toSignal(this.facade.errorMessageKey$, { initialValue: null });

  /** Filtre de la liste des quartiers. Sur 87 lignes, chercher au clavier bat le défilement. */
  protected readonly search = signal('');
  /** Repli du panneau des réglages : ils ont des défauts sensés, on ne les ouvre que pour les changer. */
  protected readonly showParameters = signal(false);
  protected readonly maxDistanceMeters = signal(PARAMETRES_PAR_DEFAUT.maxDistanceMeters ?? 50);
  /**
   * Écart maximal entre deux blocs voisins d'une même close. Le back a son propre défaut, mais
   * il n'était JAMAIS envoyé : l'écran ne postait que `maxDistanceMeters`, donc personne ne
   * savait ce qui s'appliquait. Même leçon que `validationType` sur les relevés — un champ
   * absent laisse le serveur choisir, et le choix ne se voit nulle part.
   */
  protected readonly maxBlocGapMeters = signal(PARAMETRES_PAR_DEFAUT.maxBlocGapMeters ?? 100);

  /**
   * Le réseau NATIONAL n'est pas une voirie de close : `SIG-RT*` sont des routes nationales et
   * `SIG-PI*` des pistes de désert, 692 tronçons versés le 2026-09-04.
   *
   * Sans cette exclusion, l'appariement « bloc → rue la plus proche » les retient : mesuré le
   * 2026-09-05, **693 blocs sur 5 121** étaient rattachés à une piste ou une nationale, et une
   * seule piste traversant un quartier ramassait des blocs sur des kilomètres. C'est la cause
   * des propositions « dispersées » signalées sur Quartier 7.
   *
   * Constante et non réglage : rattacher une adresse à une piste de désert n'est jamais le
   * résultat voulu, il n'y a rien à arbitrer.
   */
  protected readonly prefixesExclus = PARAMETRES_PAR_DEFAUT.excludeStreetCodePrefixes ?? [];
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

  /**
   * Les trois réglages partent ENSEMBLE et explicitement. L'écran n'envoyait que la distance,
   * laissant le back décider du reste sans que rien ne le montre à l'écran.
   */
  /**
   * Confirme le plan relu. Une confirmation navigateur avant d'écrire : c'est la seule action
   * irréversible de l'écran — les closes créées ne se défont pas depuis ici, et les numéros
   * d'adresse peuvent se figer dans un code.
   */
  protected confirm(): void {
    const count = this.proposals().length;
    if (!window.confirm(this.transloco.translate('closes.generation.applyConfirm', { count }))) {
      return;
    }

    this.facade.apply();
  }

  /* -- confirmation générale ---------------------------------------------------------------- */

  protected readonly bulk = toSignal(this.facade.bulk$, { initialValue: initialBulkState });
  protected readonly bulkTotals = toSignal(this.facade.bulkTotals$, {
    initialValue: {
      quartiers: 0, closes: 0, adresses: 0, blocsUnassigned: 0, numeroCollisions: 0,
      overCap: 0, closesCreated: 0, adressesRenumbered: 0, echecs: 0, recenses: 0,
    },
  });

  /** Les quartiers qu'un recensement traiterait — ceux qui ont encore des blocs à rattacher. */
  protected readonly quartiersRestants = computed(
    () => this.progress().filter((q) => q.blocsRemaining > 0).length,
  );

  /** Pendant un enchaînement, on ne laisse pas déclencher autre chose sur le même état. */
  protected readonly bulkBusy = computed(
    () => this.bulk().phase === 'surveying' || this.bulk().phase === 'applying',
  );

  protected bulkSurvey(): void { this.facade.bulkSurvey(); }
  protected bulkReset(): void { this.facade.bulkReset(); }

  /**
   * La confirmation générale — la seule action de l'écran qui écrit sur PLUSIEURS quartiers.
   *
   * Deux choses sont dites avant d'écrire, parce qu'aucune ne se rattrape après :
   *
   * 1. **il n'y a pas de transaction globale.** Le back n'expose qu'une route par quartier ; un
   *    échec en cours de route laisse les précédents écrits, et les closes ne se défont pas
   *    depuis cet écran ;
   * 2. **les plans de numérotation seront acceptés sans relecture.** Ces numéros finissent figés
   *    dans un code d'adresse. C'est le prix de la confirmation générale, et il se dit ici.
   */
  protected bulkConfirm(): void {
    const t = this.bulkTotals();
    const message = this.transloco.translate('closes.generation.bulk.confirmPrompt', {
      closes: t.closes,
      quartiers: t.quartiers,
      adresses: t.adresses,
      numbering: t.numeroCollisions,
    });
    if (!window.confirm(message)) return;

    this.facade.bulkApply();
  }

  protected applyParameters(): void {
    this.facade.setParameters({
      maxDistanceMeters: this.maxDistanceMeters(),
      maxBlocGapMeters: this.maxBlocGapMeters(),
      excludeStreetCodePrefixes: this.prefixesExclus,
    });
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
