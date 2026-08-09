import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UUID } from '../../models/das.models';
import { BlockListItem, BlockListQuery, BlockWithLots } from '../models/blocks.models';

/**
 * NOTE : list/getById/assign utilisent des chemins provisoires (/blocks) posés
 * avant réception de la spec API réelle (dasApi_v1.json, /blocs) — à aligner.
 * list renvoie désormais le format enrichi BlockListItem (agent + lots).
 */
@Injectable({ providedIn: 'root' })
export class BlocksApiService extends BlocksApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.get('apiBaseUrl')}/blocks`;
  }

  override list(query: BlockListQuery): Observable<BlockListItem[]> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    if (query.adminUnitId) params['adminUnitId'] = query.adminUnitId;
    return this.http.get<BlockListItem[]>(this.baseUrl, { params });
  }

  override getById(id: UUID): Observable<BlockWithLots> {
    return this.http.get<BlockWithLots>(`${this.baseUrl}/${id}`);
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}/assign`, { userId });
  }

  /**
   * Endpoint réel : PATCH /api/blocs/{id} (BlocBody) — remplacement complet
   * exigeant code + name + boundaryWkt. boundaryWkt n'existe pas côté frontend :
   * risque d'écrasement géométrique (voir demande backend, point prioritaire).
   */
  override setName(id: UUID, name: string): Observable<Block> {
    return this.getById(id).pipe(
      switchMap((current: BlockWithLots) =>
        this.http.patch<Block>(`${this.config.get('apiBaseUrl')}/blocs/${id}`, {
          code: current.code,
          name,
          boundaryWkt: null,
        }),
      ),
    );
  }
}
