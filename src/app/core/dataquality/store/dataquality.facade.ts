import { Injectable, computed, inject, signal } from '@angular/core';
import { DataQualityApiPort } from '../services/dataquality-api.port';
import { SuspiciousSurveysData } from '../models/dataquality.models';

@Injectable({ providedIn: 'root' })
export class DataQualityFacade {
  private api = inject(DataQualityApiPort);

  private readonly _data = signal<SuspiciousSurveysData | null>(null);
  private readonly _loading = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly surveys = computed(() => this._data()?.surveys ?? []);
  readonly pushedAfterCloseByAgent = computed(() => this._data()?.pushedAfterCloseByAgent ?? []);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({
      next: (d) => { this._data.set(d); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }
}
