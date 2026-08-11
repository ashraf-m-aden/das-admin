import { Component, OnInit, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { DataQualityFacade } from '../../core/dataquality/store/dataquality.facade';
import { PageHeaderComponent } from '../../core/layout/page-header/page-header.component';
import { QualityCaseStatus, QualitySeverity } from '../../core/models/das.models';
import { DecimalPipe } from '@angular/common';

const SEVERITY: Record<QualitySeverity, { color: string; bg: string }> = {
  high: { color: '#b91c1c', bg: '#fee2e2' },
  medium: { color: '#b45309', bg: '#fef3c7' },
  low: { color: '#15803d', bg: '#dcfce7' },
};
const CASE_STATUS: Record<QualityCaseStatus, { color: string; bg: string }> = {
  new: { color: '#b45309', bg: '#fef3c7' },
  in_review: { color: '#1d4ed8', bg: '#dbeafe' },
  resolved: { color: '#15803d', bg: '#dcfce7' },
};

@Component({
  selector: 'das-data-quality',
  standalone: true,
  imports: [TranslocoModule, PageHeaderComponent,DecimalPipe],
  templateUrl: './data-quality.component.html',
  styleUrl: './data-quality.component.scss',
})
export class DataQualityComponent implements OnInit {
  protected facade = inject(DataQualityFacade);

  ngOnInit(): void { this.facade.load(); }

  toggle(id: string, current: boolean): void { this.facade.toggleRule(id, !current); }
  runScan(): void { this.facade.runScan(); }

  severity(s: QualitySeverity) { return SEVERITY[s]; }
  severityLabelKey(s: QualitySeverity): string { return `dataquality.severity.${s}`; }
  caseStatus(s: QualityCaseStatus) { return CASE_STATUS[s]; }
  caseStatusLabelKey(s: QualityCaseStatus): string { return `dataquality.caseStatus.${s}`; }

  coverageColor(pct: number): string {
    if (pct >= 95) return '#166534';
    if (pct >= 85) return '#16a34a';
    if (pct >= 70) return '#4ade80';
    if (pct >= 50) return '#bbf7d0';
    return '#e5e7eb';
  }
}
