import { Injectable, computed, inject, signal } from '@angular/core';
import { PostcodesApiPort } from '../services/postcodes-api.port';
import { AllocatePostcodePayload, PostcodesData } from '../models/postcodes.models';

@Injectable({ providedIn: 'root' })
export class PostcodesFacade {
  private api = inject(PostcodesApiPort);

  private readonly _data = signal<PostcodesData | null>(null);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly rows = computed(() => this._data()?.rows ?? []);
  readonly monthly = computed(() => this._data()?.monthly ?? []);

  load(): void {
    this._loading.set(true);
    this.api.load().subscribe({
      next: (data) => { this._data.set(data); this._loading.set(false); },
      error: () => this._loading.set(false),
    });
  }

  allocate(payload: AllocatePostcodePayload): void {
    this._saving.set(true);
    this.api.allocate(payload).subscribe({
      next: () => { this._saving.set(false); this.load(); },
      error: () => this._saving.set(false),
    });
  }
}
