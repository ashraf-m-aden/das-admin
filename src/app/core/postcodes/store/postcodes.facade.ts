import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { PostcodesApiPort } from '../services/postcodes-api.port';
import { CityPostcodeRow, QuartierPostcodeRow } from '../models/postcodes.models';
import { UUID } from '../../models/das.models';

/** Lit `err.error.code` (HttpErrorResponse réel) ou `err.code` (throwError direct du mock) — les deux formes coexistent dans ce repo. */
function errorCode(err: unknown): string | undefined {
  const e = err as { error?: { code?: string }; code?: string } | null | undefined;
  return e?.error?.code ?? e?.code;
}

@Injectable({ providedIn: 'root' })
export class PostcodesFacade {
  private api = inject(PostcodesApiPort);

  private readonly _quartiers = signal<QuartierPostcodeRow[]>([]);
  private readonly _cities = signal<CityPostcodeRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _savingId = signal<UUID | null>(null);
  private readonly _errorMessageKey = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly savingId = this._savingId.asReadonly();
  readonly errorMessageKey = this._errorMessageKey.asReadonly();
  readonly cities = this._cities.asReadonly();

  readonly quartiers = computed(() => {
    const cityNameById = new Map(this._cities().map((c) => [c.id, c.name]));
    return this._quartiers().map((q) => ({ ...q, cityName: cityNameById.get(q.cityId) ?? '—' }));
  });

  readonly kpis = computed(() => ({
    withPostcode: this._quartiers().filter((q) => q.postcode !== null).length,
    withoutPostcode: this._quartiers().filter((q) => q.postcode === null).length,
    citiesWithoutCode: this._cities().filter((c) => c.code === null).length,
  }));

  load(): void {
    this._loading.set(true);
    this._errorMessageKey.set(null);
    forkJoin({ quartiers: this.api.listQuartiers(), cities: this.api.listCities() }).subscribe({
      next: ({ quartiers, cities }) => {
        this._quartiers.set(quartiers);
        this._cities.set(cities);
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
        this._errorMessageKey.set('common.error');
      },
    });
  }

  updateAreaNumber(row: QuartierPostcodeRow, areaNumber: number): void {
    this._savingId.set(row.id);
    this._errorMessageKey.set(null);
    this.api.updateQuartierAreaNumber({ current: row, areaNumber }).subscribe({
      next: (updated) => {
        this._quartiers.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
        this._savingId.set(null);
      },
      error: (err) => {
        this._savingId.set(null);
        this._errorMessageKey.set(
          errorCode(err) === 'Quartiers.AreaNumberAlreadyUsed' ? 'postcodes.errorAreaNumberUsed' : 'common.error',
        );
      },
    });
  }

  /** Le code d'une ville change le code postal de tous ses quartiers d'un coup — on recharge tout plutôt que de patcher une seule ligne. */
  updateCityCode(row: CityPostcodeRow, code: number): void {
    this._savingId.set(row.id);
    this._errorMessageKey.set(null);
    this.api.updateCityCode({ current: row, code }).subscribe({
      next: () => {
        this._savingId.set(null);
        this.load();
      },
      error: (err) => {
        this._savingId.set(null);
        this._errorMessageKey.set(
          errorCode(err) === 'Cities.CodeAlreadyUsed' ? 'postcodes.errorCityCodeUsed' : 'common.error',
        );
      },
    });
  }
}
