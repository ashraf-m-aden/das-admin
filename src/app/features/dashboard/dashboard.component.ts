import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { DasNumberPipe } from '../../core/i18n/das-locale.pipes';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { BlockStatus, ClientAccountStatus } from '../../core/dashboard/models/dashboard.models';

const DONUT_RADIUS = 42;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const STATUS_COLOR: Record<BlockStatus, string> = {
  approved: '#16a34a',
  in_progress: '#d97706',
  submitted: '#7c3aed',
  assigned: '#2563eb',
  not_assigned: '#9aa3b5',
  needs_redo: '#dc2626',
};

const CLIENT_STATUS_COLOR: Record<ClientAccountStatus, string> = {
  active: '#16a34a',
  trial: '#d97706',
  suspended: '#9aa3b5',
};

@Component({
  selector: 'das-dashboard',
  standalone: true,
  imports: [TranslocoModule, DasNumberPipe, PageHeaderComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private facade = inject(DashboardFacade);

  protected readonly summary = toSignal(this.facade.summary$);
  protected readonly isLoading = toSignal(this.facade.isLoading$);

  protected readonly donutCircumference = DONUT_CIRCUMFERENCE;

  protected readonly blocksTotal = computed(() =>
    (this.summary()?.blocksByStatus ?? []).reduce((sum, s) => sum + s.count, 0),
  );

  protected readonly statusSegments = computed(() => {
    const list = this.summary()?.blocksByStatus ?? [];
    const total = this.blocksTotal();
    let acc = 0;
    return list.map((s) => {
      const fraction = total === 0 ? 0 : s.count / total;
      const length = fraction * DONUT_CIRCUMFERENCE;
      const rotate = -90 + acc * 360;
      acc += fraction;
      return {
        status: s.status,
        count: s.count,
        color: STATUS_COLOR[s.status],
        dashArray: `${length} ${DONUT_CIRCUMFERENCE}`,
        rotate,
      };
    });
  });

  protected readonly weeklyBars = computed(() => {
    const list = this.summary()?.weeklyCollections ?? [];
    const max = Math.max(1, ...list.map((w) => w.count));
    const lastIndex = list.length - 1;
    return list.map((w, i) => ({
      label: w.weekLabel,
      count: w.count,
      heightPercent: Math.round((w.count / max) * 100),
      isCurrent: i === lastIndex,
    }));
  });

  protected readonly clientConsumption = computed(() => {
    const list = this.summary()?.apiConsumptionByClient ?? [];
    const max = Math.max(1, ...list.map((c) => c.calls));
    return list.map((c) => ({
      ...c,
      color: CLIENT_STATUS_COLOR[c.status],
      widthPercent: Math.round((c.calls / max) * 100),
    }));
  });

  protected readonly zoneProgress = computed(() =>
    (this.summary()?.zoneProgress ?? []).map((z) => ({
      zoneName: z.zoneName,
      percent: z.totalCount === 0 ? 0 : Math.round((z.approvedCount / z.totalCount) * 100),
    })),
  );

  ngOnInit(): void {
    this.facade.loadSummary();
  }

  statusLabelKey(status: BlockStatus): string {
    return `status.block.${status}`;
  }

  clientStatusLabelKey(status: ClientAccountStatus): string {
    return `status.client.${status}`;
  }
}
