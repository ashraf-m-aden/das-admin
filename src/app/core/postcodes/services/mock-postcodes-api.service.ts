import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { PostcodesApiPort } from './postcodes-api.port';
import {
  CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload, UpdateQuartierAreaNumberPayload,
} from '../models/postcodes.models';

const LATENCY_MS = 320;

function computePostcode(cityCode: number | null, areaNumber: number | null): string | null {
  if (cityCode === null || areaNumber === null) return null;
  return `${String(cityCode).padStart(2, '0')}${String(areaNumber).padStart(3, '0')}`;
}

/** Reflète l'état réel relevé le 2026-08-23 : Djibouti a un code, Ali Sabieh non ; seul Quartier 7 a un numéro. */
@Injectable({ providedIn: 'root' })
export class MockPostcodesApiService extends PostcodesApiPort {
  private cities: Array<{ id: string; name: string; code: number | null }> = [
    { id: 'city-djibouti', name: 'Djibouti', code: 77 },
    { id: 'city-ali-sabieh', name: 'Ali Sabieh', code: null },
  ];

  private quartiers: Array<{ id: string; nom: string; code: string; areaNumber: number | null; cityId: string; communeId: string | null; zoneId: string | null }> = [
    { id: 'q-7', nom: 'Quartier 7', code: 'Q7', areaNumber: 7, cityId: 'city-djibouti', communeId: null, zoneId: null },
    { id: 'q-einguela', nom: 'Einguela', code: 'Ein', areaNumber: null, cityId: 'city-djibouti', communeId: null, zoneId: null },
    { id: 'q-cheik-moussa', nom: 'Cheik Moussa', code: 'CM', areaNumber: null, cityId: 'city-djibouti', communeId: null, zoneId: null },
    { id: 'q-shell', nom: 'Quartier Shell', code: 'QS', areaNumber: null, cityId: 'city-djibouti', communeId: null, zoneId: null },
    { id: 'q-ali', nom: 'Quartier Ali', code: 'QA', areaNumber: null, cityId: 'city-djibouti', communeId: null, zoneId: null },
    { id: 'q-chateau-eau', nom: "Château d'eau", code: 'CD', areaNumber: null, cityId: 'city-djibouti', communeId: null, zoneId: null },
  ];

  private toQuartierRow(q: (typeof this.quartiers)[number]): QuartierPostcodeRow {
    const city = this.cities.find((c) => c.id === q.cityId);
    return {
      id: q.id, nom: q.nom, code: q.code, areaNumber: q.areaNumber,
      postcode: computePostcode(city?.code ?? null, q.areaNumber),
      cityId: q.cityId, communeId: q.communeId, zoneId: q.zoneId,
    };
  }

  private toCityRow(c: (typeof this.cities)[number]): CityPostcodeRow {
    return { id: c.id, name: c.name, code: c.code };
  }

  override listQuartiers(): Observable<QuartierPostcodeRow[]> {
    return of(this.quartiers.map((q) => this.toQuartierRow(q))).pipe(delay(LATENCY_MS));
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
