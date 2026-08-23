import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AdresseApiPort } from './adresse-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, BulkUpdatePayload, AdresseFilterOptions,
  AdressePageResult, AdresseQuery, AdresseSummary, UpdateAdressePayload, WORKFLOW_STAGES,
} from '../models/adresse.models';

/**
 * `workflowBreakdown` n'est pas garanti dans la réponse : back antérieur à la livraison du
 * champ, ou liste partielle (étapes à 0 omises). On renvoie TOUJOURS les 5 étapes, complétées
 * à 0 — sinon le `.map()` du dashboard casse la page entière sur un champ absent.
 */
function normalizeSummary(raw: AdresseSummary): AdresseSummary {
  const byStage = new Map((raw.workflowBreakdown ?? []).map((w) => [w.stage, w.count]));
  return {
    ...raw,
    workflowBreakdown: WORKFLOW_STAGES.map((stage) => ({ stage, count: byStage.get(stage) ?? 0 })),
  };
}

@Injectable({ providedIn: 'root' })
export class AdresseApiService extends AdresseApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  /**
   * Ressource backend = /adresses (l'entité domaine réelle).
   * Le préfixe /adresse appartenait au vocabulaire de l'écran, pas à la ressource ;
   * le nom interne « adresse » (module, facade, composant) reste inchangé côté front.
   */
  private get baseUrl(): string { return `${this.config.get('apiBaseUrl')}/adresses`; }

  override summary(): Observable<AdresseSummary> {
    return this.http.get<AdresseSummary>(`${this.baseUrl}/summary`).pipe(map(normalizeSummary));
  }
  override filterOptions(): Observable<AdresseFilterOptions> { return this.http.get<AdresseFilterOptions>(`${this.baseUrl}/filter-options`); }
  override list(query: AdresseQuery): Observable<AdressePageResult> {
    return this.http.post<AdressePageResult>(`${this.baseUrl}/search`, query);
  }
  override getDetail(id: UUID): Observable<AddressDetail> { return this.http.get<AddressDetail>(`${this.baseUrl}/${id}`); }
  override update(id: UUID, payload: UpdateAdressePayload): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}`, payload);
  }
  override bulkUpdate(payload: BulkUpdatePayload): Observable<void> { return this.http.patch<void>(`${this.baseUrl}/bulk`, payload); }
}
