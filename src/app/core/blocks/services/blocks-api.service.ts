import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UUID } from '../../models/das.models';
import { BlockListItem, BlockListQuery, BlockWithParcels } from '../models/blocks.models';

/**
 * Chemins provisoires (/blocks) à aligner sur la spec réelle (/blocs).
 * list = format enrichi (agent + parcelles). setName conserve le risque
 * boundaryWkt documenté (PATCH remplacement complet).
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

  override getById(id: UUID): Observable<BlockWithParcels> {
    return this.http.get<BlockWithParcels>(`${this.baseUrl}/${id}`);
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}/assign`, { userId });
  }

  override setName(id: UUID, name: string): Observable<Block> {
    return this.getById(id).pipe(
      switchMap((current) =>
        this.http.patch<Block>(`${this.config.get('apiBaseUrl')}/blocs/${id}`, {
          code: current.code,
          name,
          boundaryWkt: null,
        }),
      ),
    );
  }
}
