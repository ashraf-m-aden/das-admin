import { Injectable, computed, inject, signal } from '@angular/core';
import { DataQualityApiPort } from '../services/dataquality-api.port';
import { DataQualityData } from '../models/dataquality.models';

@Injectable({ providedIn: 'root' })
export class DataQualityFacade {
  private api = inject(DataQualityApiPort);

  private readonly _data = signal<DataQualityData | null>(null);
  private readonly _loading = signal(false);
  private readonly _scanning = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly scanning = this._scanning.asReadonly();
  readonly rules = computed(() => this._data()?.rules ?? []);
  readonly alerts = computed(() => this._data()?.alerts ?? []);
  readonly regionCoverage = computed(() => this._data()?.regionCoverage ?? []);
  readonly duplicates = computed(() => this._data()?.duplicates ?? []);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({
      next: (d) => { this._data.set(d); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }

  toggleRule(id: string, enabled: boolean): void {
    // maj optimiste
    const current = this._data();
    if (current) {
      this._data.set({ ...current, rules: current.rules.map((r) => (r.id === id ? { ...r, enabled } : r)) });
    }
    this.api.toggleRule(id, enabled).subscribe({ error: () => this.load() });
  }

  runScan(): void {
    this._scanning.set(true);
    this.api.runScan().subscribe({
      next: () => { this._scanning.set(false); this.load(); },
      error: () => this._scanning.set(false),
    });
  }
}
