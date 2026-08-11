import { Injectable, computed, inject, signal } from '@angular/core';
import { AuditApiPort } from '../services/audit-api.port';
import { AuditData, AuditFilters } from '../models/audit.models';

@Injectable({ providedIn: 'root' })
export class AuditFacade {
  private api = inject(AuditApiPort);

  private readonly _data = signal<AuditData | null>(null);
  private readonly _loading = signal(false);

  readonly rows = computed(() => this._data()?.rows ?? []);
  readonly total = computed(() => this._data()?.total ?? 0);
  readonly loading = this._loading.asReadonly();

  load(filters: AuditFilters): void {
    this._loading.set(true);
    this.api.load(filters).subscribe({ next: (d) => { this._data.set(d); this._loading.set(false); }, error: () => this._loading.set(false) });
  }
}
