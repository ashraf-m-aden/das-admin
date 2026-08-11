import { Injectable, computed, inject, signal } from '@angular/core';
import { FieldOpsApiPort } from '../services/fieldops-api.port';
import { FieldOpsData } from '../models/fieldops.models';

@Injectable({ providedIn: 'root' })
export class FieldOpsFacade {
  private api = inject(FieldOpsApiPort);

  private readonly _data = signal<FieldOpsData | null>(null);
  private readonly _loading = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly teams = computed(() => this._data()?.teams ?? []);
  readonly columns = computed(() => this._data()?.columns ?? []);
  readonly review = computed(() => this._data()?.review ?? null);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({
      next: (data) => { this._data.set(data); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }
}
