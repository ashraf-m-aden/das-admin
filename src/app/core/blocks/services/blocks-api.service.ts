import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UUID } from '../../models/das.models';
import { BlockListQuery, BlockWithLots } from '../models/blocks.models';

/**
 * Implémentation réelle. Endpoints attendus côté API .NET :
 *   GET   /blocks?search=&status=&adminUnitId=  -> Block[]
 *   GET   /blocks/{id}                          -> BlockWithLots
 *   PATCH /blocks/{id}/assign                   -> Block
 *
 * Note : la LISTE de blocs (utilisée pour l'écran liste + filtres) passe par
 * ici, mais la CARTE en mode réel ne passe jamais par cet endpoint — elle
 * consomme directement les tuiles vectorielles Martin (voir
 * blocks-map.component.ts + map-style.service.ts), pour rester performante
 * à l'échelle nationale.
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
}
