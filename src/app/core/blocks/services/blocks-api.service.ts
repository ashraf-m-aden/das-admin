import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, BlockStatus, UUID } from '../../models/das.models';
import { BlockListItem, BlockListQuery, BlockWithParcels } from '../models/blocks.models';

@Injectable({ providedIn: 'root' })
export class BlocksApiService extends BlocksApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/blocs`; }   // /blocs, pas /blocks

  override list(query: BlockListQuery): Observable<BlockListItem[]> {
    const params: Record<string, string> = {};
    if (query.search) params['search'] = query.search;
    if (query.status) params['status'] = query.status;
    if (query.cityId) params['cityId'] = query.cityId;
    if (query.communeId) params['communeId'] = query.communeId;
    if (query.zoneId) params['zoneId'] = query.zoneId;
    if (query.quartierId) params['quartierId'] = query.quartierId;
    return this.http.get<BlockListItem[]>(this.baseUrl, { params });
  }

  override getById(id: UUID): Observable<BlockWithParcels> {
    return this.http.get<BlockWithParcels>(`${this.baseUrl}/${id}`);
  }

  override assign(id: UUID, userId: UUID): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}/assign`, { userId });
  }

  // Spec : POST /blocs/{id}/name { name } (fini le PATCH remplacement complet — plus de risque geometry loss)
  override setName(id: UUID, name: string): Observable<Block> {
    return this.http.post<Block>(`${this.baseUrl}/${id}/name`, { name });
  }
  override setStatus(id: UUID, status: BlockStatus): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}/status`, { status });
  }
}
