import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UUID } from '../../models/das.models';
import { BlockListQuery, BlockWithLots } from '../models/blocks.models';

/**
 * NOTE : list/getById/assign ci-dessous utilisent des chemins provisoires
 * (/blocks) posés avant réception de la spec API réelle (dasApi_v1.json,
 * qui utilise /api/blocs) — à corriger dans une passe dédiée. setName()
 * ci-dessous, en revanche, est déjà aligné sur l'endpoint réel confirmé.
 */
@Injectable({ providedIn: 'root' })
export class BlocksApiService extends BlocksApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/blocks`;
  }

  override list(query: BlockListQuery): Observable<Block[]> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    if (query.adminUnitId) params['adminUnitId'] = query.adminUnitId;
    return this.http.get<Block[]>(this.baseUrl, { params });
  }

  override getById(id: UUID): Observable<BlockWithLots> {
    return this.http.get<BlockWithLots>(`${this.baseUrl}/${id}`);
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}/assign`, { userId });
  }

  /**
   * Endpoint réel : PATCH /api/blocs/{id} (BlocBody), qui exige code + name +
   * boundaryWkt TOUS renseignés (remplacement complet, pas un merge partiel).
   * On renvoie ici le code déjà connu côté client, mais boundaryWkt n'existe
   * pas dans notre modèle frontend — risque réel de l'écraser à null tant
   * que ce point n'est pas confirmé avec le backend (voir demande envoyée).
   */
  override setName(id: UUID, name: string): Observable<Block> {
    return this.getById(id).pipe(
      // On récupère d'abord le bloc pour connaître son code actuel, puisque
      // le PATCH exige de le renvoyer intact.
      switchMapToPatch(this.http, `${this.config.get('apiBaseUrl')}/blocs/${id}`, name),
    );
  }
}

// Petit utilitaire local pour enchaîner GET (code actuel) -> PATCH (nouveau nom).
import { HttpClient as _HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs';
function switchMapToPatch(http: _HttpClient, url: string, name: string) {
  return switchMap((current: BlockWithLots) =>
    http.patch<Block>(url, { code: current.code, name, boundaryWkt: null }),
  );
}
