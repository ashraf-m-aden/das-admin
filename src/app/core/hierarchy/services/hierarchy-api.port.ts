import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { HierarchyNode } from '../models/hierarchy.models';

export abstract class HierarchyApiPort {
  abstract cities(): Observable<HierarchyNode[]>;
  abstract communes(cityId: UUID): Observable<HierarchyNode[]>;
  abstract zones(communeId: UUID): Observable<HierarchyNode[]>;
  abstract quartiers(zoneId: UUID): Observable<HierarchyNode[]>;
  abstract blocs(quartierId: UUID): Observable<HierarchyNode[]>;
}
