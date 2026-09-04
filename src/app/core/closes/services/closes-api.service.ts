import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ClosesApiPort } from './closes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AdresseNumbering, ApplyQuartierClosesPayload, AppliedQuartierCloses, Close, CloseListQuery,
  CloseNumberingPlan, CloseStreetOption, CreateClosePayload, QuartierClosePlan,
  QuartierClosePlanParameters, QuartierCloseProgress, ReviewedClose, UpdateClosePayload,
} from '../models/closes.models';

/** `closes` arrive sous la même forme brute que partout ailleurs : on repasse par `toClose`. */
interface RawAppliedResponse {
  closesCreated: number;
  blocsAttached: number;
  adressesRenumbered: number;
  closes: RawCloseResponse[];
}

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

interface RawStreetResponse { id: string; code: string; name: string | null; type: string; boundaryWkt: string | null; }

function toStreetOption(r: RawStreetResponse): CloseStreetOption {
  return { id: r.id, code: r.code, name: r.name, type: r.type, boundaryWkt: r.boundaryWkt };
}

@Injectable({ providedIn: 'root' })
export class ClosesApiService extends ClosesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/closes`; }
  private get streetsUrl() { return `${this.config.get('apiBaseUrl')}/streets`; }

  override listStreets(): Observable<CloseStreetOption[]> {
    return this.http.get<RawStreetResponse[]>(this.streetsUrl).pipe(map((rows) => rows.map(toStreetOption)));
  }

  override renameStreet(street: CloseStreetOption, name: string): Observable<CloseStreetOption> {
    // Remplacement complet : `code` et `type` sont renvoyés tels quels. `boundaryWkt` à `null`
    // laisse le tracé existant en place — le handler ne l'écrase que s'il reçoit une géométrie.
    const body = { code: street.code, name, type: street.type, boundaryWkt: street.boundaryWkt };
    return this.http.patch<RawStreetResponse>(`${this.streetsUrl}/${street.id}`, body).pipe(map(toStreetOption));
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

  /* ---------------------------------------------------------------------------------------
   * GÉNÉRATION PAR QUARTIER
   *
   * Ces routes vivent sous `/quartiers`, pas sous `/closes` : leur sujet est le quartier, et
   * c'est lui qui porte l'unicité de `Number` et de `Code`.
   * ------------------------------------------------------------------------------------ */

  private get quartiersUrl() { return `${this.config.get('apiBaseUrl')}/quartiers`; }

  override listQuartierProgress(): Observable<QuartierCloseProgress[]> {
    return this.http.get<QuartierCloseProgress[]>(`${this.quartiersUrl}/closes-progress`);
  }

  override previewQuartierCloses(
    quartierId: UUID,
    params: Partial<QuartierClosePlanParameters>,
  ): Observable<QuartierClosePlan> {
    // Corps partiel assumé : le back applique ses défauts et renvoie ce qu'il a retenu dans
    // `plan.parameters`. On n'invente pas de valeurs par défaut ici, elles divergeraient.
    return this.http.post<QuartierClosePlan>(`${this.quartiersUrl}/${quartierId}/closes/preview`, params);
  }

  override previewProposedCloseNumbering(
    quartierId: UUID,
    close: ReviewedClose,
    reverse: boolean,
  ): Observable<CloseNumberingPlan> {
    // `numbering` n'est pas envoyé : c'est ce qu'on demande, pas ce qu'on fournit.
    const body = {
      streetId: close.streetId, number: close.number, code: close.code,
      blocIds: close.blocIds, reverse,
    };
    return this.http.post<CloseNumberingPlan>(
      `${this.quartiersUrl}/${quartierId}/closes/numbering-preview`, body);
  }

  override applyQuartierCloses(
    quartierId: UUID,
    payload: ApplyQuartierClosesPayload,
  ): Observable<AppliedQuartierCloses> {
    return this.http
      .post<RawAppliedResponse>(`${this.quartiersUrl}/${quartierId}/closes`, payload)
      .pipe(map((raw) => ({
        closesCreated: raw.closesCreated,
        blocsAttached: raw.blocsAttached,
        adressesRenumbered: raw.adressesRenumbered,
        closes: raw.closes.map(toClose),
      })));
  }
}
