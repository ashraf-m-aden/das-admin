import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { PostcodesApiPort } from '../services/postcodes-api.port';
import { CityPostcodeRow, QuartierPostcodeRow, ZoneRow } from '../models/postcodes.models';
import { UUID } from '../../models/das.models';
import { ErrorKeyMap, toErrorKey } from '../../http/error-code';

/** Codes métier de `PATCH /api/quartiers/{id}` et `PATCH /api/cities/{id}`, relus dans la source `dasApi`. */
const ERROR_KEY_BY_CODE: ErrorKeyMap = {
  'Quartiers.AreaNumberAlreadyUsed': 'postcodes.errorAreaNumberUsed',
  'Cities.CodeAlreadyUsed': 'postcodes.errorCityCodeUsed',
  'Quartiers.ZoneWithoutCommune': 'postcodes.errorZoneWithoutCommune',
  'Quartiers.ZoneOutsideCommune': 'postcodes.errorZoneOutsideCommune',
};

@Injectable({ providedIn: 'root' })
export class PostcodesFacade {
  private api = inject(PostcodesApiPort);

  private readonly _quartiers = signal<QuartierPostcodeRow[]>([]);
  private readonly _cities = signal<CityPostcodeRow[]>([]);
  private readonly _zones = signal<ZoneRow[]>([]);
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

  /**
   * Les zones avec leur composition réelle, recalculée depuis les quartiers chargés.
   *
   * `quartierCount` renvoyé par l'API n'est pas réutilisé ici : après un rattachement, seule
   * la ligne du quartier est rafraîchie, pas la liste des zones — s'appuyer sur le compteur
   * du serveur afficherait un total périmé jusqu'au prochain rechargement complet.
   */
  readonly zonesWithQuartiers = computed(() => {
    const quartiers = this.quartiers();
    return this._zones()
      .map((z) => ({ ...z, quartiers: quartiers.filter((q) => q.zoneId === z.id) }))
      .sort((a, b) => a.communeName.localeCompare(b.communeName) || a.code.localeCompare(b.code));
  });

  /**
   * Quartiers rattachables à une zone donnée : ceux de SA commune qui n'y sont pas déjà.
   *
   * Un quartier sans commune n'est jamais candidat — une zone est une partie d'une commune,
   * le back refuse le rattachement en `Quartiers.ZoneWithoutCommune`. Le filtrer ici évite
   * de proposer un geste qui échouera à coup sûr.
   */
  eligibleQuartiers(zone: ZoneRow) {
    return this.quartiers()
      .filter((q) => q.communeId !== null && q.communeId === zone.communeId && q.zoneId !== zone.id)
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }

  /**
   * Zones qu'un quartier donné peut rejoindre : celles de SA commune, et rien d'autre.
   *
   * Renvoie une liste VIDE quand le quartier n'a pas de commune — ce n'est pas un cas d'erreur
   * mais l'état normal de plusieurs quartiers hors Djibouti-ville. Le gabarit s'en sert pour
   * afficher la raison plutôt qu'un menu déroulant vide, qui se lirait comme une panne.
   */
  zonesForQuartier(communeId: UUID | null): ZoneRow[] {
    if (communeId === null) return [];
    return this._zones()
      .filter((z) => z.communeId === communeId)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /** Quartiers d'une commune connue mais sans zone : c'est le travail qu'il reste à faire. */
  readonly unassignedQuartiers = computed(() =>
    this.quartiers().filter((q) => q.communeId !== null && q.zoneId === null));

  /** Quartiers qu'aucune zone ne peut accueillir tant qu'ils n'ont pas de commune. */
  readonly quartiersWithoutCommune = computed(() =>
    this.quartiers().filter((q) => q.communeId === null));

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
      // Les zones servent au coloriage de fond de la carte et au bloc de rattachement : un
      // échec ne doit pas priver l'écran de sa liste, d'où le repli sur un tableau vide.
      zones: this.api.listZones().pipe(catchError(() => of([] as ZoneRow[]))),
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

  /** Rattache un quartier à une zone, ou l'en détache avec `zoneId: null`. */
  assignZone(row: QuartierPostcodeRow, zoneId: UUID | null): void {
    this._savingId.set(row.id);
    this._errorMessageKey.set(null);
    this.api.assignQuartierZone({ current: row, zoneId }).subscribe({
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
