import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PostcodesApiPort } from './postcodes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import {
  CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload, UpdateQuartierAreaNumberPayload,
  ZoneOption,
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
  boundaryWkt: string | null;
}

interface RawCityResponse {
  id: string;
  name: string;
  code: number | null;
}

function toQuartierRow(raw: RawQuartierResponse): QuartierPostcodeRow {
  return {
    id: raw.id, nom: raw.nom, code: raw.code, areaNumber: raw.areaNumber, postcode: raw.postcode,
    cityId: raw.cityId, communeId: raw.communeId, zoneId: raw.zoneId, boundaryWkt: raw.boundaryWkt,
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

  override listZones(): Observable<ZoneOption[]> {
    return this.http.get<{ id: string; name: string }[]>(`${this.baseUrl}/zones`).pipe(
      map((rows) => rows.map((z) => ({ id: z.id, name: z.name }))),
    );
  }

  override listCities(): Observable<CityPostcodeRow[]> {
    return this.http.get<RawCityResponse[]>(`${this.baseUrl}/cities`).pipe(map((rows) => rows.map(toCityRow)));
  }

  override updateQuartierAreaNumber({ current, areaNumber }: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow> {
    // `code` est VOLONTAIREMENT omis. Il est optionnel côté back (« omis, le code actuel est
    // conservé »), et le renvoyer tel quel fait échouer la requête sur les quartiers existants :
    // le validateur exige des lettres majuscules sans chiffre, or « Q7 » est en base depuis
    // avant cette règle. Un écran qui relit-modifie-réécrit ne doit pas revalider un champ
    // qu'il ne change pas — il ferait porter à l'opérateur une dette de données qui n'est pas
    // la sienne, sur un champ que son geste ne touche même pas.
    const body = {
      nom: current.nom, areaNumber,
      cityId: current.cityId, communeId: current.communeId, zoneId: current.zoneId,
    };
    return this.http.patch<RawQuartierResponse>(`${this.baseUrl}/quartiers/${current.id}`, body).pipe(map(toQuartierRow));
  }

  override updateCityCode({ current, code }: UpdateCityCodePayload): Observable<CityPostcodeRow> {
    const body = { name: current.name, code };
    return this.http.patch<RawCityResponse>(`${this.baseUrl}/cities/${current.id}`, body).pipe(map(toCityRow));
  }
}
