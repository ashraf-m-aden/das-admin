import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HierarchyApiPort } from './hierarchy-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { HierarchyNode } from '../models/hierarchy.models';

@Injectable({ providedIn: 'root' })
export class HierarchyApiService extends HierarchyApiPort {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);
  private get baseUrl() { return this.config.get('apiBaseUrl'); }

  override cities(): Observable<HierarchyNode[]> {
    return this.http.get<HierarchyNode[]>(`${this.baseUrl}/cities`);
  }
  override communes(cityId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<HierarchyNode[]>(`${this.baseUrl}/communes`, { params: { cityId } });
  }
  override zones(communeId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<HierarchyNode[]>(`${this.baseUrl}/zones`, { params: { communeId } });
  }
  override quartiers(cityId: UUID, communeId?: UUID | null, zoneId?: UUID | null): Observable<HierarchyNode[]> {
    const params: Record<string, string> = { cityId };
    if (communeId) params['communeId'] = communeId;
    if (zoneId) params['zoneId'] = zoneId;
    return this.http.get<HierarchyNode[]>(`${this.baseUrl}/quartiers`, { params });
  }
  override blocs(quartierId: UUID): Observable<HierarchyNode[]> {
    // Projection HIÉRARCHIE (id/code/name/bbox) — distincte de la liste riche /blocs du module Blocs.
    return this.http.get<HierarchyNode[]>(`${this.baseUrl}/blocs`, { params: { quartierId } });
  }
}
