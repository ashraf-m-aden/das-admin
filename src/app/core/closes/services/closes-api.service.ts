import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ClosesApiPort } from './closes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, Close, CloseListQuery, CloseNumberingPlan, CloseStreetOption,
  CreateClosePayload, UpdateClosePayload,
} from '../models/closes.models';

interface RawCloseBlocResponse {
  id: string;
  code: string;
  name: string | null;
  number: number | null;
}

interface RawCloseResponse {
  id: string;
  quartierId: string;
  quartierNom: string;
  quartierCode: string;
  streetId: string;
  streetCode: string;
  streetName: string | null;
  streetType: string;
  number: number;
  code: string;
  label: string;
  blocs: RawCloseBlocResponse[];
  adresseCount: number;
  boundaryWkt: string | null;
}

function toClose(raw: RawCloseResponse): Close {
  return {
    id: raw.id, quartierId: raw.quartierId, quartierNom: raw.quartierNom, quartierCode: raw.quartierCode,
    streetId: raw.streetId, streetCode: raw.streetCode, streetName: raw.streetName,
    number: raw.number, code: raw.code, label: raw.label,
    blocs: raw.blocs.map((b) => ({ id: b.id, code: b.code, name: b.name, number: b.number })),
    adresseCount: raw.adresseCount, boundaryWkt: raw.boundaryWkt,
  };
}

@Injectable({ providedIn: 'root' })
export class ClosesApiService extends ClosesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/closes`; }
  private get streetsUrl() { return `${this.config.get('apiBaseUrl')}/streets`; }

  override listStreets(): Observable<CloseStreetOption[]> {
    return this.http.get<{ id: string; code: string; name: string | null }[]>(this.streetsUrl).pipe(
      map((rows) => rows.map((r) => ({ id: r.id, code: r.code, name: r.name }))),
    );
  }

  override list(query: CloseListQuery): Observable<Close[]> {
    const params: Record<string, string> = {};
    if (query.quartierId) params['quartierId'] = query.quartierId;
    if (query.streetId) params['streetId'] = query.streetId;
    return this.http.get<RawCloseResponse[]>(this.baseUrl, { params }).pipe(map((rows) => rows.map(toClose)));
  }

  override getById(id: UUID): Observable<Close> {
    return this.http.get<RawCloseResponse>(`${this.baseUrl}/${id}`).pipe(map(toClose));
  }

  override create(payload: CreateClosePayload): Observable<Close> {
    return this.http.post<RawCloseResponse>(this.baseUrl, payload).pipe(map(toClose));
  }

  override update(id: UUID, payload: UpdateClosePayload): Observable<Close> {
    return this.http.patch<RawCloseResponse>(`${this.baseUrl}/${id}`, payload).pipe(map(toClose));
  }

  override remove(id: UUID): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  override previewAttachBlocs(id: UUID, blocIds: UUID[], reverse: boolean): Observable<CloseNumberingPlan> {
    return this.http.post<CloseNumberingPlan>(`${this.baseUrl}/${id}/blocs/preview`, { blocIds, reverse });
  }

  override attachBlocs(id: UUID, blocIds: UUID[], numbering?: AdresseNumbering[]): Observable<Close> {
    // `numbering` omis (et non `null`) quand il n'y en a pas : le back distingue « pas de plan »
    // de « plan vide », et un plan vide serait refusé comme incomplet.
    const body = numbering?.length ? { blocIds, numbering } : { blocIds };
    return this.http.post<RawCloseResponse>(`${this.baseUrl}/${id}/blocs`, body).pipe(map(toClose));
  }

  override detachBloc(id: UUID, blocId: UUID): Observable<Close> {
    return this.http.delete<RawCloseResponse>(`${this.baseUrl}/${id}/blocs/${blocId}`).pipe(map(toClose));
  }
}
