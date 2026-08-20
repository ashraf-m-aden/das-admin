import { Observable } from 'rxjs';
import { OccupationCatalogItem } from '../models/reference.models';

/** Catalogues de référence transverses (`/api/types-occupation`, `/api/etats-occupation`). */
export abstract class ReferenceApiPort {
  abstract getTypesOccupation(): Observable<OccupationCatalogItem[]>;
  abstract getEtatsOccupation(): Observable<OccupationCatalogItem[]>;
}
