import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { BasemapLayerGroup, DasMapComponent } from '../../core/ui/map/das-map.component';
import { TileLayerBinding } from '../../core/ui/map/map.models';
import {
  BLOCS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP, STREETS_BASEMAP_GROUP, SIG_VOIRIE_BASEMAP_GROUP, SIG_ILOTS_BASEMAP_GROUP,
} from '../../core/ui/map/basemap-groups';
import { AddressWorkflowStage } from '../../core/models/das.models';
import { WORKFLOW_STAGES } from '../../core/adresse/models/adresse.models';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};
const STAGE_ICON: Record<AddressWorkflowStage, string> = {
  registered: 'ti ti-home', surveyed: 'ti ti-clipboard-check', verified: 'ti ti-shield-check',
  approved: 'ti ti-thumb-up', published: 'ti ti-send-2',
};

/**
 * Parcelles du référentiel, coloriées par étape de workflow. La coloration est BAKÉE dans
 * `map-style.json` (`match` sur `workflowStage`) et non posée en feature-state : à cette échelle
 * on affiche tout le référentiel, et surcharger des milliers de features ferait du style thrash.
 * La légende de l'écran lit la même palette, donc les deux ne peuvent pas diverger.
 *
 * Calque d'AFFICHAGE : pas d'`interactiveLayerId`. Le tableau de bord ne pilote aucune sélection,
 * un clic n'aurait nulle part où aller.
 */
const ADRESSES_TILE: TileLayerBinding = {
  id: 'adresses', labelKey: 'adresse.layerParcels', source: 'adresses', sourceLayer: 'adresses_tiles',
  styleLayerIds: ['adresses-fill', 'adresses-line'], visible: true,
};

@Component({
  selector: 'das-dashboard',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, RouterLink, TranslocoModule, PageHeaderComponent, DasMapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private facade = inject(DashboardFacade);

  protected readonly tileLayers: TileLayerBinding[] = [ADRESSES_TILE];

  /**
   * Voirie visible d'emblée — sans elle, des parcelles flottent sur du vide depuis le retrait du
   * fond CARTO. Blocs et closes restent décochés : ce sont des découpages de travail, on les
   * allume quand on les cherche.
   *
   * ⚠️ PAS d'`ADRESSES_BASEMAP_GROUP` ici : il porte le même id (`adresses`) et exactement les
   * mêmes `styleLayerIds` que `ADRESSES_TILE` ci-dessus. Les deux déclarés, le panneau afficherait
   * deux cases pour les mêmes couches, et le groupe — décoché par défaut — l'emporterait
   * puisqu'`applyVisibility` traite les groupes de fond APRÈS les tuiles : les parcelles seraient
   * éteintes en permanence sans que la case « Parcelles » n'y puisse rien.
   */
  protected readonly basemapLayers: BasemapLayerGroup[] = [
    STREETS_BASEMAP_GROUP, BLOCS_BASEMAP_GROUP, CLOSES_BASEMAP_GROUP,
    SIG_VOIRIE_BASEMAP_GROUP, SIG_ILOTS_BASEMAP_GROUP,
  ];

  protected readonly summary = toSignal(this.facade.summary$);
  protected readonly isLoading$ = this.facade.isLoading$;

  /** Funnel cumulatif : nombre/part des adresses ayant atteint AU MOINS cette étape (pas isolée). */
  protected readonly workflowFunnel = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const total = s.totalRecords || 1;
    const byStage = new Map((s.workflowBreakdown ?? []).map((w) => [w.stage, w.count]));
    return WORKFLOW_STAGES.map((stage, i) => {
      const cumulative = WORKFLOW_STAGES.slice(i).reduce((sum, st) => sum + (byStage.get(st) ?? 0), 0);
      return { stage, count: cumulative, percent: Math.round((cumulative / total) * 100) };
    });
  });

  /** Regroupement à 3 tranches (vérifié = verified+approved+published) pour le donut — dérivé du même workflowBreakdown. */
  protected readonly verificationDonut = computed(() => {
    const s = this.summary();
    if (!s) return null;
    const total = s.totalRecords || 1;
    const byStage = new Map((s.workflowBreakdown ?? []).map((w) => [w.stage, w.count]));
    const verified = (byStage.get('verified') ?? 0) + (byStage.get('approved') ?? 0) + (byStage.get('published') ?? 0);
    const pending = byStage.get('surveyed') ?? 0;
    const unverified = byStage.get('registered') ?? 0;
    const pct = (n: number) => Math.round((n / total) * 100);
    return {
      verified, pending, unverified,
      verifiedPct: pct(verified), pendingPct: pct(pending), unverifiedPct: pct(unverified),
    };
  });

  protected readonly donutGradient = computed(() => {
    const d = this.verificationDonut();
    if (!d) return 'none';
    const c1 = d.verifiedPct;
    const c2 = c1 + d.pendingPct;
    return `conic-gradient(#16a34a 0% ${c1}%, #d97706 ${c1}% ${c2}%, #6b7280 ${c2}% 100%)`;
  });

  /**
   * Part d'adresses pourvues d'une voie — l'indicateur de tête du dashboard v2.
   *
   * Ce n'est PAS un taux d'avancement du recensement : c'est la part de parcelles qui peuvent
   * seulement recevoir un code d'adresse. Une parcelle sans close n'est pas « en retard », elle
   * est structurellement hors d'atteinte tant qu'aucun bloc ne la rattache.
   */
  protected readonly coveragePercent = computed(() => {
    const c = this.summary()?.coverage;
    if (!c || c.totalAdresses === 0) return 0;
    return Math.round((c.adressesWithClose / c.totalAdresses) * 100);
  });

  /** Verrous restants, du plus bloquant au moins bloquant, avec leur part traitée. */
  protected readonly blockers = computed(() => (this.summary()?.coverage.blockers ?? [])
    .map((b) => ({
      ...b,
      done: b.total - b.remaining,
      // `total` à 0 = rien à traiter : on affiche 100 % plutôt qu'une division par zéro.
      percent: b.total === 0 ? 100 : Math.round(((b.total - b.remaining) / b.total) * 100),
    }))
    .sort((a, b) => b.remaining - a.remaining));

  /** Vrai dès qu'un seul compteur de dette est non nul — sinon le bloc affiche son état sain. */
  protected readonly hasDebt = computed(() => {
    const d = this.summary()?.verificationDebt;
    if (!d) return false;
    return d.temporaryAwaitingRecheck > 0 || d.stalledSubmissions > 0 || (d.oldestStalledDays ?? 0) > 0;
  });

  protected readonly chargePercent = computed(() => {
    const c = this.summary()?.activeCampaign?.charge;
    if (!c || c.total === 0) return 0;
    return Math.round((c.done / c.total) * 100);
  });

  ngOnInit(): void {
    this.facade.loadSummary();
  }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageIcon(stage: AddressWorkflowStage): string { return STAGE_ICON[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
