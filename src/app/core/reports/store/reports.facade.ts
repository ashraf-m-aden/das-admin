import { Injectable, computed, inject, signal } from '@angular/core';
import { ReportsApiPort } from '../services/reports-api.port';
import { ReportExportFormat, ReportsData } from '../models/reports.models';

@Injectable({ providedIn: 'root' })
export class ReportsFacade {
  private api = inject(ReportsApiPort);

  private readonly _data = signal<ReportsData | null>(null);
  private readonly _loading = signal(false);
  private readonly _busy = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly growth = computed(() => this._data()?.growth ?? []);
  readonly regional = computed(() => this._data()?.regional ?? []);
  readonly turnaround = computed(() => this._data()?.turnaround ?? []);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({
      next: (d) => { this._data.set(d); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }
readonly regionShapes = computed(() => this._data()?.regionShapes ?? []);
  exportReport(format: ReportExportFormat): void {
    this._busy.set(true);
    this.api.exportReport(format).subscribe({ next: () => this._busy.set(false), error: () => this._busy.set(false) });
  }

  generateReport(): void {
    this._busy.set(true);
    this.api.generateReport().subscribe({ next: () => this._busy.set(false), error: () => this._busy.set(false) });
  }
}
