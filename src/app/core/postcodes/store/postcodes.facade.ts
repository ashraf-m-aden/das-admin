import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { PostcodesApiPort } from '../services/postcodes-api.port';
import { CityPostcodeRow, QuartierPostcodeRow, ZoneOption } from '../models/postcodes.models';
import { UUID } from '../../models/das.models';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/** Codes métier de `PATCH /api/quartiers/{id}` et `PATCH /api/cities/{id}`, relus dans la source `dasApi`. */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'Quartiers.AreaNumberAlreadyUsed': 'postcodes.errorAreaNumberUsed',
  'Cities.CodeAlreadyUsed': 'postcodes.errorCityCodeUsed',
};

@Injectable({ providedIn: 'root' })
export class PostcodesFacade {
  private api = inject(PostcodesApiPort);

  private readonly _quartiers = signal<QuartierPostcodeRow[]>([]);
  private readonly _cities = signal<CityPostcodeRow[]>([]);
  private readonly _zones = signal<ZoneOption[]>([]);
  private readonly _loading = signal(false);
  private readonly _savingId = signal<UUID | null>(null);
  private readonly _errorMessageKey = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly savingId = this._savingId.asReadonly();
  readonly errorMessageKey = this._errorMessageKey.asReadonly();
  readonly cities = this._cities.asReadonly();
  readonly zones = this._zones.asReadonly();

  readonly quartiers = computed(() => {
    const cityById = new Map(this._cities().map((c) => [c.id, c]));
    return this._quartiers().map((q) => {
      const city = cityById.get(q.cityId);
      // Un code postal absent a DEUX causes possibles, et l'opérateur ne peut pas deviner
      // laquelle : le code de la ville, qu'il corrige dans le bloc Villes, ou le numéro du
      // quartier, qu'il corrige sur cette ligne. Les distinguer évite de chercher au mauvais
      // endroit — cas réel rencontré le 2026-08-27.
      const missingReason: 'cityCode' | 'areaNumber' | null =
        q.postcode !== null ? null
          : city?.code == null ? 'cityCode'
            : 'areaNumber';
      return { ...q, cityName: city?.name ?? '—', cityCode: city?.code ?? null, missingReason };
    });
  });

  readonly kpis = computed(() => ({
    withPostcode: this._quartiers().filter((q) => q.postcode !== null).length,
    withoutPostcode: this._quartiers().filter((q) => q.postcode === null).length,
    citiesWithoutCode: this._cities().filter((c) => c.code === null).length,
  }));

  load(): void {
    this._loading.set(true);
    this._errorMessageKey.set(null);
    forkJoin({
      quartiers: this.api.listQuartiers(),
      cities: this.api.listCities(),
      // Les zones ne servent qu'au coloriage de fond de la carte : un échec ne doit pas priver
      // l'écran de sa liste, d'où le repli sur un tableau vide plutôt qu'une erreur globale.
      zones: this.api.listZones().pipe(catchError(() => of([] as ZoneOption[]))),
    }).subscribe({
      next: ({ quartiers, cities, zones }) => {
        this._quartiers.set(quartiers);
        this._cities.set(cities);
        this._zones.set(zones);
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
        this._errorMessageKey.set(toErrorKey(err, ERROR_KEY_BY_CODE));
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
        this._errorMessageKey.set(toErrorKey(err, ERROR_KEY_BY_CODE));
      },
    });
  }
}
