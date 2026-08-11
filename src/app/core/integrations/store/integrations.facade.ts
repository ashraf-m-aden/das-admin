import { Injectable, computed, inject, signal } from '@angular/core';
import { IntegrationsApiPort } from '../services/integrations-api.port';
import { IntegrationsData } from '../models/integrations.models';

@Injectable({ providedIn: 'root' })
export class IntegrationsFacade {
  private api = inject(IntegrationsApiPort);

  private readonly _data = signal<IntegrationsData | null>(null);
  private readonly _loading = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly items = computed(() => this._data()?.items ?? []);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({ next: (d) => { this._data.set(d); this._loading.set(false); }, error: () => this._loading.set(false) });
  }

  toggle(id: string, connect: boolean): void {
    const cur = this._data();
    if (cur) this._data.set({ ...cur, items: cur.items.map((i) => i.id === id ? { ...i, status: connect ? 'connected' : 'disconnected' } : i) });
    this.api.toggle(id, connect).subscribe({ error: () => this.load() });
  }
}
