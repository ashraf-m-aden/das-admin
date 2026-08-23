import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClosesApiPort } from './closes-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { Close, CloseListQuery, SaveClosePayload } from '../models/closes.models';

/**
 * ⚠️ Écrit d'avance : `/api/closes` **n'existe pas encore** côté `dasApi` (cf.
 * `docs/plans/adressage.md` §3.3). `backend-readiness.ts` déclare le module `mock`, donc ce
 * service n'est jamais injecté aujourd'hui. Les routes ci-dessous sont la forme attendue, à
 * confronter au contrat réel le jour de la livraison back — ne pas les considérer comme vérifiées.
 */
@Injectable({ providedIn: 'root' })
export class ClosesApiService extends ClosesApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/closes`; }

  override list(query: CloseListQuery): Observable<Close[]> {
    const params: Record<string, string> = {};
    if (query.quartierId) params['quartierId'] = query.quartierId;
    if (query.search.trim()) params['search'] = query.search.trim();
    return this.http.get<Close[]>(this.baseUrl, { params });
  }

  override getById(id: UUID): Observable<Close> {
    return this.http.get<Close>(`${this.baseUrl}/${id}`);
  }

  override create(payload: SaveClosePayload): Observable<Close> {
    return this.http.post<Close>(this.baseUrl, payload);
  }

  override update(id: UUID, payload: SaveClosePayload): Observable<Close> {
    return this.http.patch<Close>(`${this.baseUrl}/${id}`, payload);
  }

  override remove(id: UUID): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
