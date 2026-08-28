import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PostcodesApiPort } from './postcodes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import {
  AssignQuartierZonePayload, CityPostcodeRow, QuartierPostcodeRow, UpdateCityCodePayload,
  UpdateQuartierAreaNumberPayload, ZoneRow,
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

/** `ZoneResponse` est enrichie : libellés de rattachement + composition, pour éviter une cascade d'appels. */
interface RawZoneResponse {
  id: string;
  name: string;
  code: string;
  communeId: string;
  communeName?: string;
  cityId?: string | null;
  cityName?: string;
  quartiers?: Array<{ id: string; nom: string; code: string }>;
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

// Les libellés de rattachement sont documentés comme toujours présents, mais un nom manquant
// ne doit pas faire disparaître la zone de l'écran : on retombe sur la chaîne vide, que le
// gabarit sait afficher, plutôt que sur `undefined` qui casserait un tri ou une comparaison.
function toZoneRow(raw: RawZoneResponse): ZoneRow {
  return {
    id: raw.id, name: raw.name, code: raw.code,
    communeId: raw.communeId, communeName: raw.communeName ?? '',
    cityId: raw.cityId ?? null, cityName: raw.cityName ?? '',
    quartierCount: raw.quartiers?.length ?? 0,
  };
}

@Injectable({ providedIn: 'root' })
export class PostcodesApiService extends PostcodesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return this.config.get('apiBaseUrl'); }

  override listQuartiers(): Observable<QuartierPostcodeRow[]> {
    return this.http.get<RawQuartierResponse[]>(`${this.baseUrl}/quartiers`).pipe(map((rows) => rows.map(toQuartierRow)));
  }

  override listZones(): Observable<ZoneRow[]> {
    return this.http.get<RawZoneResponse[]>(`${this.baseUrl}/zones`).pipe(map((rows) => rows.map(toZoneRow)));
  }

  override listCities(): Observable<CityPostcodeRow[]> {
    return this.http.get<RawCityResponse[]>(`${this.baseUrl}/cities`).pipe(map((rows) => rows.map(toCityRow)));
  }

  override updateQuartierAreaNumber({ current, areaNumber }: UpdateQuartierAreaNumberPayload): Observable<QuartierPostcodeRow> {
    return this.patchQuartier({ ...current, areaNumber });
  }

  override assignQuartierZone({ current, zoneId }: AssignQuartierZonePayload): Observable<QuartierPostcodeRow> {
    return this.patchQuartier({ ...current, zoneId });
  }

  /**
   * `PATCH /api/quartiers/{id}` attend le corps COMPLET (guide §3) : c'est un remplacement,
   * pas un patch champ par champ. Les deux gestes de cet écran relisent donc la ligne et la
   * réécrivent entière, en ne changeant que leur champ.
   *
   * `code` est VOLONTAIREMENT omis. Il est optionnel côté back (« omis, le code actuel est
   * conservé »), et le renvoyer tel quel fait échouer la requête sur les quartiers existants :
   * le validateur exige des lettres majuscules sans chiffre, or « Q7 » est en base depuis
   * avant cette règle. Un écran qui relit-modifie-réécrit ne doit pas revalider un champ
   * qu'il ne change pas — il ferait porter à l'opérateur une dette de données qui n'est pas
   * la sienne, sur un champ que son geste ne touche même pas.
   */
  private patchQuartier(next: QuartierPostcodeRow): Observable<QuartierPostcodeRow> {
    const body = {
      nom: next.nom, areaNumber: next.areaNumber,
      cityId: next.cityId, communeId: next.communeId, zoneId: next.zoneId,
    };
    return this.http.patch<RawQuartierResponse>(`${this.baseUrl}/quartiers/${next.id}`, body).pipe(map(toQuartierRow));
  }

  override updateCityCode({ current, code }: UpdateCityCodePayload): Observable<CityPostcodeRow> {
    const body = { name: current.name, code };
    return this.http.patch<RawCityResponse>(`${this.baseUrl}/cities/${current.id}`, body).pipe(map(toCityRow));
  }
}
