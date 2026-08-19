import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlocksApiPort } from './blocks-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { Block, UpdateBlockPayload, UUID } from '../../models/das.models';
import { BlockListQuery } from '../models/blocks.models';

@Injectable({ providedIn: 'root' })
export class BlocksApiService extends BlocksApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return `${this.config.get('apiBaseUrl')}/blocs`; }

  override list(query: BlockListQuery): Observable<Block[]> {
    const params: Record<string, string> = {};
    if (query.quartierId) params['quartierId'] = query.quartierId;
    return this.http.get<Block[]>(this.baseUrl, { params });
  }

  override getById(id: UUID): Observable<Block> {
    return this.http.get<Block>(`${this.baseUrl}/${id}`);
  }

  override update(id: UUID, payload: UpdateBlockPayload): Observable<Block> {
    return this.http.patch<Block>(`${this.baseUrl}/${id}`, payload);
  }
}
