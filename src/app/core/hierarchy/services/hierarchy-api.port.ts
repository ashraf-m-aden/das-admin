import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { HierarchyNode } from '../models/hierarchy.models';

export abstract class HierarchyApiPort {
  abstract cities(): Observable<HierarchyNode[]>;
  abstract communes(cityId: UUID): Observable<HierarchyNode[]>;
  abstract zones(communeId: UUID): Observable<HierarchyNode[]>;
  /** cityId obligatoire (rattachement structurant du quartier) ; commune/zone affinent si fournies. */
  abstract quartiers(cityId: UUID, communeId?: UUID | null, zoneId?: UUID | null): Observable<HierarchyNode[]>;
  /** Closes du quartier — `GET /api/closes?quartierId=`. Liste vide tant que la reprise de données n'a pas eu lieu. */
  abstract closes(quartierId: UUID): Observable<HierarchyNode[]>;
  abstract blocs(quartierId: UUID): Observable<HierarchyNode[]>;
}
