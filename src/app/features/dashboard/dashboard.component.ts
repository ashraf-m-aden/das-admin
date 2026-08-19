import { Component, OnInit, computed, inject } from '@angular/core';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { DashboardFacade } from '../../core/dashboard/store/dashboard.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DasDatePipe } from '../../core/i18n/das-locale.pipes';
import { ActivityKind, DashboardSummary } from '../../core/dashboard/models/dashboard.models';
import { AddressWorkflowStage } from '../../core/models/das.models';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { DateRangeButtonComponent } from '../../core/ui/date-range/date-range-button.component';

const STAGE_COLOR: Record<AddressWorkflowStage, string> = {
  registered: '#6b7280', surveyed: '#d97706', verified: '#16a34a', approved: '#0d9488', published: '#7c3aed',
};
const ACTIVITY_ICON: Record<ActivityKind, { icon: string; color: string; bg: string }> = {
  batch_approved: { icon: 'ti-circle-check', color: '#15803d', bg: '#dcfce7' },
  postcode_created: { icon: 'ti-mail', color: '#1d4ed8', bg: '#dbeafe' },
  survey_uploaded: { icon: 'ti-upload', color: '#6d28d9', bg: '#f3e8fd' },
  duplicate_flagged: { icon: 'ti-flag', color: '#b91c1c', bg: '#fee2e2' },
  published: { icon: 'ti-send', color: '#0d9488', bg: '#ccfbf1' },
  quality_rule: { icon: 'ti-shield', color: '#b45309', bg: '#fef3c7' },
};

@Component({
  selector: 'das-dashboard',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, RouterLink, TranslocoModule,DasMapComponent, PageHeaderComponent, DasDatePipe,DateRangeButtonComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private facade = inject(DashboardFacade);

  protected readonly summary = toSignal(this.facade.summary$);
  protected readonly isLoading$ = this.facade.isLoading$;

  private readonly TREND_W = 300;
  private readonly TREND_H = 90;
  private readonly R = 54;
  private readonly C = 2 * Math.PI * 54;
protected readonly mapFeatures = computed<MapFeature[]>(() =>
    (this.summary()?.mapPoints ?? []).map((p) => ({
      id: p.id, layerId: 'addresses', geometry: p.location, color: STAGE_COLOR[p.stage],
    })),
  );
  protected readonly mapLayers: MapLayerConfig[] = [
    { id: 'addresses', labelKey: 'dashboard.layerAddresses', type: 'point', visible: true },
  ];
  protected readonly trendPoints = computed(() => {
    const t = this.summary()?.registrationsTrend ?? [];
    if (t.length < 2) return '';
    const max = Math.max(...t.map((p) => p.value));
    const min = Math.min(...t.map((p) => p.value));
    const span = max - min || 1;
    return t.map((p, i) => {
      const x = (i / (t.length - 1)) * this.TREND_W;
      const y = this.TREND_H - ((p.value - min) / span) * (this.TREND_H - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  protected readonly trendLabels = computed(() => this.summary()?.registrationsTrend ?? []);
private static readonly LEVEL_ROUTE: Record<string, string> = {
    region: '/adresse', ville: '/adresse', commune: '/adresse', quartier: '/adresse',
    bloc: '/blocks', rue: '/addressing', parcelle: '/adresse',
  };

  levelRoute(level: string): string {
    return DashboardComponent.LEVEL_ROUTE[level] ?? '/adresse';
  }onPickDate(): void { /* TODO: ouvrir le sélecteur de période (calendrier) */ }
  protected readonly donut = computed(() => {
    const v = this.summary()?.verification;
    if (!v) return [] as { color: string; dasharray: string; offset: number }[];
    const total = v.verified + v.pending + v.unverified || 1;
    const segs = [
      { val: v.verified, color: '#16a34a' },
      { val: v.pending, color: '#d97706' },
      { val: v.unverified, color: '#cbd5e1' },
    ];
    let acc = 0;
    return segs.map((s) => {
      const frac = s.val / total;
      const dash = frac * this.C;
      const seg = { color: s.color, dasharray: `${dash.toFixed(2)} ${(this.C - dash).toFixed(2)}`, offset: -acc * this.C };
      acc += frac;
      return seg;
    });
  });

  protected readonly verifiedPct = computed(() => {
    const v = this.summary()?.verification;
    if (!v) return 0;
    const total = v.verified + v.pending + v.unverified || 1;
    return Math.round((v.verified / total) * 100);
  });

  protected readonly circumference = this.C;
  protected readonly radius = this.R;

  ngOnInit(): void {
    this.facade.loadSummary();
  }

  stageColor(stage: AddressWorkflowStage): string { return STAGE_COLOR[stage]; }
  stageLabelKey(stage: AddressWorkflowStage): string { return `status.stage.${stage}`; }
  levelLabelKey(level: string): string { return `dashboard.level.${level}`; }
  activityIcon(kind: ActivityKind) { return ACTIVITY_ICON[kind]; }
  deltaIcon(dir: string): string { return dir === 'down' ? 'ti-arrow-down-right' : dir === 'flat' ? 'ti-minus' : 'ti-arrow-up-right'; }

  asSummary(s: DashboardSummary | undefined): DashboardSummary | null { return s ?? null; }
}
