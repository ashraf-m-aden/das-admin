import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HierarchyApiPort } from './hierarchy-api.port';
import { UUID } from '../../models/das.models';
import { Bbox4326, HierarchyNode } from '../models/hierarchy.models';

@Injectable({ providedIn: 'root' })
export class HierarchyMockService extends HierarchyApiPort {
  private readonly cityId = '11111111-1111-1111-1111-111111111111';
  private readonly communeId = '22222222-2222-2222-2222-222222222222';
  private readonly zoneId = '33333333-3333-3333-3333-333333333333';
  private readonly quartier7Id = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';
  private readonly boulaos: Bbox4326 = [43.13, 11.57, 43.16, 11.60];

  // Seule Djibouti-ville est découpée en communes (§5 CLAUDE.md) : une deuxième ville sans
  // commune ni zone illustre l'état normal et définitif d'un quartier directement sous sa ville.
  private readonly aliSabiehCityId = '44444444-4444-4444-4444-444444444444';
  private readonly aliSabiehQuartierId = '55555555-5555-5555-5555-555555555555';
  private readonly aliSabieh: Bbox4326 = [42.70, 11.14, 42.75, 11.18];

  override cities(): Observable<HierarchyNode[]> {
    return of([
      { id: this.cityId, level: 'city', code: 'DJ', name: 'Djibouti', parentId: null, bbox: [42.9, 11.45, 43.35, 11.75] } as HierarchyNode,
      { id: this.aliSabiehCityId, level: 'city', code: 'AS', name: 'Ali Sabieh', parentId: null, bbox: this.aliSabieh } as HierarchyNode,
    ]);
  }
  override communes(cityId: UUID): Observable<HierarchyNode[]> {
    if (cityId === this.aliSabiehCityId) return of([]); // ville non découpée en communes
    return of([{ id: this.communeId, level: 'commune', code: 'BLS', name: 'Boulaos', parentId: cityId, bbox: this.boulaos } as HierarchyNode]);
  }
  override zones(communeId: UUID): Observable<HierarchyNode[]> {
    if (communeId !== this.communeId) return of([]);
    return of([{ id: this.zoneId, level: 'zone', code: 'Z-Q7', name: 'Zone Quartier 7', parentId: communeId, bbox: this.boulaos } as HierarchyNode]);
  }
  override quartiers(cityId: UUID, communeId?: UUID | null, zoneId?: UUID | null): Observable<HierarchyNode[]> {
    if (cityId === this.aliSabiehCityId) {
      return of([{ id: this.aliSabiehQuartierId, level: 'quartier', code: 'AS-C', name: 'Ali Sabieh Centre', parentId: cityId, bbox: this.aliSabieh } as HierarchyNode]);
    }
    return of([{ id: this.quartier7Id, level: 'quartier', code: 'Q7', name: 'Quartier 7', parentId: zoneId ?? communeId ?? cityId, bbox: this.boulaos } as HierarchyNode]);
  }
  /** Mêmes ids que MockClosesApiService. Le quartier Ali Sabieh n'a AUCUNE close : c'est le cas creux, le select doit s'y masquer. */
  override closes(quartierId: UUID): Observable<HierarchyNode[]> {
    if (quartierId !== this.quartier7Id) return of([]);
    return of([
      { id: 'close-0001', level: 'close', code: 'CL-01', name: 'Impasse du Puits', parentId: quartierId, bbox: this.boulaos },
      { id: 'close-0002', level: 'close', code: 'CL-02', name: '2', parentId: quartierId, bbox: this.boulaos },
    ] as HierarchyNode[]);
  }

  override blocs(quartierId: UUID): Observable<HierarchyNode[]> {
    return of([
      { id: 'bloc-0001', level: 'bloc', code: 'Q7-B01', name: 'Bloc 01', parentId: quartierId, closeId: 'close-0001', bbox: [43.140, 11.585, 43.146, 11.590] },
      { id: 'bloc-0002', level: 'bloc', code: 'Q7-B02', name: 'Bloc 02', parentId: quartierId, closeId: null, bbox: [43.146, 11.585, 43.152, 11.590] },
    ] as HierarchyNode[]);
  }
}
