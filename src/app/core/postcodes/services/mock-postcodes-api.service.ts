import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { PostcodesApiPort } from './postcodes-api.port';
import {
  AssignQuartierZonePayload, CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload,
  UpdateQuartierAreaNumberPayload, ZoneRow,
} from '../models/postcodes.models';

const LATENCY_MS = 320;

function computePostcode(cityCode: number | null, areaNumber: number | null): string | null {
  if (cityCode === null || areaNumber === null) return null;
  return `${String(cityCode).padStart(2, '0')}${String(areaNumber).padStart(3, '0')}`;
}

/**
 * Reflète le plan de numérotation repris le 2026-08-27 : Djibouti a un code, Ali Sabieh non ;
 * les zones portent le chiffre des centaines de l'areaNumber (Z1 = 1xx, Z3 = 3xx, Z6 = 6xx).
 *
 * Le jeu contient volontairement les deux cas qui font échouer un rattachement de zone —
 * un quartier sans commune et un quartier d'une autre commune que la zone visée. Sans eux,
 * la branche mock ne permettrait pas de voir l'écran se comporter correctement en erreur.
 */
@Injectable({ providedIn: 'root' })
export class MockPostcodesApiService extends PostcodesApiPort {
  private cities: Array<{ id: string; name: string; code: number | null }> = [
    { id: 'city-djibouti', name: 'Djibouti', code: 77 },
    { id: 'city-ali-sabieh', name: 'Ali Sabieh', code: null },
  ];

  private zones: ZoneRow[] = [
    { id: 'zone-z1', name: 'Ras-Dika 1', code: 'Z1', communeId: 'com-ras-dika', communeName: 'RAS DIKA', cityId: 'city-djibouti', cityName: 'Djibouti', quartierCount: 0 },
    { id: 'zone-z3', name: 'Boulaos 3', code: 'Z3', communeId: 'com-boulaos', communeName: 'BOULAOS', cityId: 'city-djibouti', cityName: 'Djibouti', quartierCount: 0 },
    { id: 'zone-z6', name: 'Balbala 6', code: 'Z6', communeId: 'com-balbala', communeName: 'BALBALA', cityId: 'city-djibouti', cityName: 'Djibouti', quartierCount: 0 },
  ];

  /** Carrés voisins : de quoi voir le coloriage et les libellés sans dépendre de vraies emprises. */
  private square(i: number): string {
    const lng = 43.130 + (i % 3) * 0.020, lat = 11.580 + Math.floor(i / 3) * 0.016;
    return `POLYGON((${lng} ${lat}, ${lng + 0.018} ${lat}, ${lng + 0.018} ${lat + 0.014}, ${lng} ${lat + 0.014}, ${lng} ${lat}))`;
  }

  private quartiers: Array<{ id: string; nom: string; code: string; areaNumber: number | null; cityId: string; communeId: string | null; zoneId: string | null; boundaryWkt: string | null }> = [
    { id: 'q-heron', nom: 'Héron', code: 'HE', areaNumber: 101, cityId: 'city-djibouti', communeId: 'com-ras-dika', zoneId: 'zone-z1', boundaryWkt: this.square(0) },
    { id: 'q-marabout', nom: 'Marabout', code: 'MA', areaNumber: 102, cityId: 'city-djibouti', communeId: 'com-ras-dika', zoneId: 'zone-z1', boundaryWkt: this.square(1) },
    { id: 'q-7', nom: 'Quartier 7', code: 'Q7', areaNumber: 310, cityId: 'city-djibouti', communeId: 'com-boulaos', zoneId: 'zone-z3', boundaryWkt: this.square(2) },
    { id: 'q-palmeraie', nom: 'Palmeraie', code: 'PA', areaNumber: 312, cityId: 'city-djibouti', communeId: 'com-boulaos', zoneId: null, boundaryWkt: this.square(3) },
    { id: 'q-pk12', nom: 'PK12', code: 'PK', areaNumber: 603, cityId: 'city-djibouti', communeId: 'com-balbala', zoneId: null, boundaryWkt: this.square(4) },
    // Sans commune : aucune zone ne peut l'accueillir tant que ce n'est pas corrigé.
    { id: 'q-einguela', nom: 'Einguela', code: 'Ein', areaNumber: 202, cityId: 'city-djibouti', communeId: null, zoneId: null, boundaryWkt: this.square(5) },
    { id: 'q-shell', nom: 'Quartier Shell', code: 'QS', areaNumber: null, cityId: 'city-ali-sabieh', communeId: null, zoneId: null, boundaryWkt: null },
  ];

  private toQuartierRow(q: (typeof this.quartiers)[number]): QuartierPostcodeRow {
    const city = this.cities.find((c) => c.id === q.cityId);
    return {
      id: q.id, nom: q.nom, code: q.code, areaNumber: q.areaNumber,
      postcode: computePostcode(city?.code ?? null, q.areaNumber),
      cityId: q.cityId, communeId: q.communeId, zoneId: q.zoneId, boundaryWkt: q.boundaryWkt,
    };
  }

  private toCityRow(c: (typeof this.cities)[number]): CityPostcodeRow {
    return { id: c.id, name: c.name, code: c.code };
  }

  override listQuartiers(): Observable<QuartierPostcodeRow[]> {
    return of(this.quartiers.map((q) => this.toQuartierRow(q))).pipe(delay(LATENCY_MS));
  }

  /** `quartierCount` est recalculé à chaque lecture : côté réel c'est le back qui l'agrège, il ne se met pas à jour tout seul dans un tableau figé. */
  override listZones(): Observable<ZoneRow[]> {
    const rows = this.zones.map((z) => ({
      ...z, quartierCount: this.quartiers.filter((q) => q.zoneId === z.id).length,
    }));
    return of(rows).pipe(delay(LATENCY_MS));
  }

  override listCities(): Observable<CityPostcodeRow[]> {
    return of(this.cities.map((c) => this.toCityRow(c))).pipe(delay(LATENCY_MS));
  }

  override updateQuartierAreaNumber({ current, areaNumber }: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow> {
    const dup = this.quartiers.some((q) => q.cityId === current.cityId && q.areaNumber === areaNumber && q.id !== current.id);
    if (dup) {
      return throwError(() => ({ code: 'Quartiers.AreaNumberAlreadyUsed', message: 'Un quartier porte déjà ce numéro dans cette ville.' })).pipe(delay(LATENCY_MS));
    }
    const q = this.quartiers.find((r) => r.id === current.id);
    if (!q) return throwError(() => ({ code: 'Quartiers.NotFound', message: 'Quartier introuvable.' }));
    q.areaNumber = areaNumber;
    return of(this.toQuartierRow(q)).pipe(delay(LATENCY_MS));
  }

  override assignQuartierZone({ current, zoneId }: AssignQuartierZonePayload): Observable<QuartierPostcodeRow> {
    const q = this.quartiers.find((r) => r.id === current.id);
    if (!q) return throwError(() => ({ code: 'Quartiers.NotFound', message: 'Quartier introuvable.' }));

    if (zoneId !== null) {
      // Une zone est une partie d'une commune, elle ne la remplace pas : sans commune, le
      // rattachement n'a pas de sens et le back le refuse.
      if (q.communeId === null) {
        return throwError(() => ({ code: 'Quartiers.ZoneWithoutCommune', message: 'zoneId fourni sans communeId.' })).pipe(delay(LATENCY_MS));
      }
      const zone = this.zones.find((z) => z.id === zoneId);
      if (!zone) return throwError(() => ({ code: 'Zones.NotFound', message: 'Zone introuvable.' }));
      if (zone.communeId !== q.communeId) {
        return throwError(() => ({ code: 'Quartiers.ZoneOutsideCommune', message: "La zone n'appartient pas à la commune indiquée." })).pipe(delay(LATENCY_MS));
      }
    }

    q.zoneId = zoneId;
    return of(this.toQuartierRow(q)).pipe(delay(LATENCY_MS));
  }

  override updateCityCode({ current, code }: UpdateCityCodePayload): Observable<CityPostcodeRow> {
    const dup = this.cities.some((c) => c.code === code && c.id !== current.id);
    if (dup) {
      return throwError(() => ({ code: 'Cities.CodeAlreadyUsed', message: 'Une ville porte déjà ce code postal.' })).pipe(delay(LATENCY_MS));
    }
    const c = this.cities.find((r) => r.id === current.id);
    if (!c) return throwError(() => ({ code: 'Cities.NotFound', message: 'Ville introuvable.' }));
    c.code = code;
    return of(this.toCityRow(c)).pipe(delay(LATENCY_MS));
  }
}
