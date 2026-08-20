import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { AddressWorkflowStage } from '../../core/models/das.models';
import { WORKFLOW_STAGES } from '../../core/adresse/models/adresse.models';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};
const STAGE_ICON: Record<AddressWorkflowStage, string> = {
  registered: 'ti ti-home', surveyed: 'ti ti-clipboard-check', verified: 'ti ti-shield-check',
  approved: 'ti ti-thumb-up', published: 'ti ti-send-2',
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

  protected readonly summary = toSignal(this.facade.summary$);
  protected readonly isLoading$ = this.facade.isLoading$;

  /** Funnel cumulatif : nombre/part des adresses ayant atteint AU MOINS cette étape (pas isolée). */
  protected readonly workflowFunnel = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const total = s.totalRecords || 1;
    const byStage = new Map(s.workflowBreakdown.map((w) => [w.stage, w.count]));
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
    const byStage = new Map(s.workflowBreakdown.map((w) => [w.stage, w.count]));
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
