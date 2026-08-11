import { Component, OnInit, computed, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { ReportsFacade } from '../../core/reports/store/reports.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { DecimalPipe } from '@angular/common';
import { MapFeature, MapLayerConfig } from '../../core/ui/map/map.models';
import { DasMapComponent } from '../../core/ui/map/das-map.component';
import { DateRangeButtonComponent } from '../../core/ui/date-range/date-range-button.component';

@Component({
  selector: 'das-reports',
  standalone: true,
  imports: [TranslocoModule, PageHeaderComponent,DecimalPipe,DasMapComponent,DateRangeButtonComponent ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  protected facade = inject(ReportsFacade);

  private readonly W = 300;
  private readonly H = 96;

  ngOnInit(): void { this.facade.load(); }

  private line(values: number[], min: number, max: number): string {
    if (values.length < 2) return '';
    const span = max - min || 1;
    return values.map((val, i) => {
      const x = (i / (values.length - 1)) * this.W;
      const y = this.H - ((val - min) / span) * (this.H - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
private coverageColor(pct: number): string {
    if (pct >= 95) return '#166534';
    if (pct >= 85) return '#16a34a';
    if (pct >= 70) return '#4ade80';
    if (pct >= 50) return '#bbf7d0';
    return '#e5e7eb';
  }

  protected readonly coverageFeatures = computed<MapFeature[]>(() =>
    this.facade.regionShapes().map((r) => ({
      id: r.region, layerId: 'regions', geometry: r.geom,
      color: this.coverageColor(r.completionPct), label: `${r.region} · ${r.completionPct} %`,
      selectable: false,
    })),
  );
  protected readonly coverageLayers: MapLayerConfig[] = [
    { id: 'regions', labelKey: 'reports.coverageByRegion', type: 'fill', visible: true },
  ];
  protected readonly growthTotalPath = computed(() => {
    const g = this.facade.growth();
    const all = g.flatMap((p) => [p.total, p.verified]);
    return this.line(g.map((p) => p.total), Math.min(...all), Math.max(...all));
  });
  protected readonly growthVerifiedPath = computed(() => {
    const g = this.facade.growth();
    const all = g.flatMap((p) => [p.total, p.verified]);
    return this.line(g.map((p) => p.verified), Math.min(...all), Math.max(...all));
  });
  protected readonly turnaroundPath = computed(() => {
    const t = this.facade.turnaround().map((p) => p.days);
    return this.line(t, 0, Math.max(6, ...t));
  });

  barHeight(pct: number): number { return Math.round(pct); }

  exportCsv(): void { this.facade.exportReport('csv'); }
  exportPdf(): void { this.facade.exportReport('pdf'); }
  generate(): void { this.facade.generateReport(); }
}
