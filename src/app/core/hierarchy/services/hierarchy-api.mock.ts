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

  override cities(): Observable<HierarchyNode[]> {
    return of([{ id: this.cityId, level: 'city', code: 'DJ', name: 'Djibouti', parentId: null, bbox: [42.9, 11.45, 43.35, 11.75] } as HierarchyNode]);
  }
  override communes(cityId: UUID): Observable<HierarchyNode[]> {
    return of([{ id: this.communeId, level: 'commune', code: 'BLS', name: 'Boulaos', parentId: cityId, bbox: this.boulaos } as HierarchyNode]);
  }
  override zones(communeId: UUID): Observable<HierarchyNode[]> {
    return of([{ id: this.zoneId, level: 'zone', code: 'Z-Q7', name: 'Zone Quartier 7', parentId: communeId, bbox: this.boulaos } as HierarchyNode]);
  }
  override quartiers(cityId: UUID, communeId?: UUID | null, zoneId?: UUID | null): Observable<HierarchyNode[]> {
    return of([{ id: this.quartier7Id, level: 'quartier', code: 'Q7', name: 'Quartier 7', parentId: zoneId ?? communeId ?? cityId, bbox: this.boulaos } as HierarchyNode]);
  }
  override blocs(quartierId: UUID): Observable<HierarchyNode[]> {
    return of([
      { id: 'bloc-0001', level: 'bloc', code: 'Q7-B01', name: 'Bloc 01', parentId: quartierId, bbox: [43.140, 11.585, 43.146, 11.590] },
      { id: 'bloc-0002', level: 'bloc', code: 'Q7-B02', name: 'Bloc 02', parentId: quartierId, bbox: [43.146, 11.585, 43.152, 11.590] },
    ] as HierarchyNode[]);
  }
}
