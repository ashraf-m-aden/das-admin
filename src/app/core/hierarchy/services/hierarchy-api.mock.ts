import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { HierarchyApiPort } from './hierarchy-api.port';
import { UUID } from '../../models/das.models';
import { Bbox4326, HierarchyNode } from '../models/hierarchy.models';

/**
 * Stub de développement. Un seul chemin réel : Djibouti → Boulaos → Zone Q7 →
 * Quartier 7 (UUID = celui du script d'import). Emprise ≈ Boulaos. À étoffer.
 */
@Injectable({ providedIn: 'root' })
export class HierarchyMockService extends HierarchyApiPort {
  private readonly cityId = '11111111-1111-1111-1111-111111111111';
  private readonly communeId = '22222222-2222-2222-2222-222222222222';
  private readonly zoneId = '33333333-3333-3333-3333-333333333333';
  private readonly quartier7Id = 'deadd2cc-fefc-403b-af2a-b7fcb9b6769f';
  private readonly boulaos: Bbox4326 = [43.13, 11.57, 43.16, 11.60];

  override cities(): Observable<HierarchyNode[]> {
    return of<HierarchyNode[]>([
      { id: this.cityId, level: 'city', code: 'DJ', name: 'Djibouti', parentId: null, bbox: [42.9, 11.45, 43.35, 11.75] },
    ]);
  }
  override communes(cityId: UUID): Observable<HierarchyNode[]> {
    return of<HierarchyNode[]>([
      { id: this.communeId, level: 'commune', code: 'BLS', name: 'Boulaos', parentId: cityId, bbox: this.boulaos },
    ]);
  }
  override zones(communeId: UUID): Observable<HierarchyNode[]> {
    return of<HierarchyNode[]>([
      { id: this.zoneId, level: 'zone', code: 'Z-Q7', name: 'Zone Quartier 7', parentId: communeId, bbox: this.boulaos },
    ]);
  }
  override quartiers(zoneId: UUID): Observable<HierarchyNode[]> {
    return of<HierarchyNode[]>([
      { id: this.quartier7Id, level: 'quartier', code: 'Q7', name: 'Quartier 7', parentId: zoneId, bbox: this.boulaos },
    ]);
  }
}
