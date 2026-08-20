import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { AddressWorkflowStage } from '../../core/models/das.models';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};

@Component({
  selector: 'das-dashboard',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, RouterLink, TranslocoModule, PageHeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private facade = inject(DashboardFacade);

  protected readonly summary = toSignal(this.facade.summary$);
  protected readonly isLoading$ = this.facade.isLoading$;

  /** `workflowBreakdown` en pourcentages du total — calculé côté front, l'API ne renvoie que les comptes. */
  protected readonly workflowSegments = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const total = s.totalRecords || 1;
    return s.workflowBreakdown.map((w) => ({ ...w, percent: Math.round((w.count / total) * 100) }));
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
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
}
