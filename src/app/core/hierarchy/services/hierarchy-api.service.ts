import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { HierarchyApiPort } from './hierarchy-api.port';
import { AppConfigService } from '../../config/app-config.service';
import { UUID } from '../../models/das.models';
import { HierarchyNode } from '../models/hierarchy.models';
import { wktBounds } from '../../ui/map/wkt.util';

/** Projection HIÉRARCHIE de `CloseResponse` — on ne garde que de quoi peupler un select et cadrer. */
interface RawCloseNode {
  id: string; code: string; label: string; quartierId: string; boundaryWkt: string | null;
}

/** Projection HIÉRARCHIE de `BlocResponse`. `closeId` sert au filtrage front (pas de `?closeId=` côté back). */
interface RawBlocNode {
  id: string; code: string; name: string | null; quartierId: string; closeId: string | null;
}

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
  override closes(quartierId: UUID): Observable<HierarchyNode[]> {
    return this.http.get<RawCloseNode[]>(`${this.baseUrl}/closes`, { params: { quartierId } }).pipe(
      map((rows) => rows.map((c): HierarchyNode => ({
        id: c.id,
        level: 'close',
        code: c.code,
        // `label` est composé par le back (repli nom de rue → numéro → code) : on le LIT.
        name: c.label,
        parentId: c.quartierId,
        bbox: c.boundaryWkt ? (wktBounds(c.boundaryWkt) ?? undefined) : undefined,
      }))),
    );
  }

  override blocs(quartierId: UUID): Observable<HierarchyNode[]> {
    // Projection HIÉRARCHIE (id/code/name/bbox) — distincte de la liste riche /blocs du module Blocs.
    return this.http.get<RawBlocNode[]>(`${this.baseUrl}/blocs`, { params: { quartierId } }).pipe(
      map((rows) => rows.map((b): HierarchyNode => ({
        id: b.id,
        level: 'bloc',
        code: b.code,
        name: b.name ?? b.code,
        parentId: b.quartierId,
        closeId: b.closeId,
      }))),
    );
  }
}
