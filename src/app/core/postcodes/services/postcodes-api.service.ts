import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PostcodesApiPort } from './postcodes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import {
  CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload, UpdateQuartierAreaNumberPayload,
} from '../models/postcodes.models';

interface RawQuartierResponse {
  id: string;
  nom: string;
  code: string;
  areaNumber: number | null;
  postcode: string | null;
  cityId: string;
  communeId: string | null;
  zoneId: string | null;
}

interface RawCityResponse {
  id: string;
  name: string;
  code: number | null;
}

function toQuartierRow(raw: RawQuartierResponse): QuartierPostcodeRow {
  return {
    id: raw.id, nom: raw.nom, code: raw.code, areaNumber: raw.areaNumber, postcode: raw.postcode,
    cityId: raw.cityId, communeId: raw.communeId, zoneId: raw.zoneId,
  };
}

function toCityRow(raw: RawCityResponse): CityPostcodeRow {
  return { id: raw.id, name: raw.name, code: raw.code };
}

@Injectable({ providedIn: 'root' })
export class PostcodesApiService extends PostcodesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return this.config.get('apiBaseUrl'); }

  override listQuartiers(): Observable<QuartierPostcodeRow[]> {
    return this.http.get<RawQuartierResponse[]>(`${this.baseUrl}/quartiers`).pipe(map((rows) => rows.map(toQuartierRow)));
  }

  override listCities(): Observable<CityPostcodeRow[]> {
    return this.http.get<RawCityResponse[]>(`${this.baseUrl}/cities`).pipe(map((rows) => rows.map(toCityRow)));
  }

  override updateQuartierAreaNumber({ current, areaNumber }: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow> {
    const body = {
      nom: current.nom, code: current.code, areaNumber,
      cityId: current.cityId, communeId: current.communeId, zoneId: current.zoneId,
    };
    return this.http.patch<RawQuartierResponse>(`${this.baseUrl}/quartiers/${current.id}`, body).pipe(map(toQuartierRow));
  }

  override updateCityCode({ current, code }: UpdateCityCodePayload): Observable<CityPostcodeRow> {
    const body = { name: current.name, code };
    return this.http.patch<RawCityResponse>(`${this.baseUrl}/cities/${current.id}`, body).pipe(map(toCityRow));
  }
}
