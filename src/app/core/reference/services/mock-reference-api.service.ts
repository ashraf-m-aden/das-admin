import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ReferenceApiPort } from './reference-api.port';
import { OccupationCatalogItem } from '../models/reference.models';

const TYPES_OCCUPATION: OccupationCatalogItem[] = [
  { id: 'type-occ-maison', nom: 'Maison individuelle' },
  { id: 'type-occ-villa', nom: 'Villa' },
  { id: 'type-occ-immeuble', nom: 'Immeuble mixte' },
  { id: 'type-occ-commerce', nom: 'Commerce' },
  { id: 'type-occ-ecole', nom: 'École' },
];

const ETATS_OCCUPATION: OccupationCatalogItem[] = [
  { id: 'etat-occ-bon', nom: 'Bon état' },
  { id: 'etat-occ-degrade', nom: 'Dégradé' },
  { id: 'etat-occ-construction', nom: 'En construction' },
  { id: 'etat-occ-ruine', nom: 'En ruine' },
];

@Injectable({ providedIn: 'root' })
export class MockReferenceApiService extends ReferenceApiPort {
  override getTypesOccupation(): Observable<OccupationCatalogItem[]> {
    return of(TYPES_OCCUPATION);
  }

  override getEtatsOccupation(): Observable<OccupationCatalogItem[]> {
    return of(ETATS_OCCUPATION);
  }
}
