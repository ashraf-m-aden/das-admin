import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { UnitsApiPort } from './units-api.port';
import { UUID } from '../../models/das.models';
import { AddressUnit, UnitType } from '../models/units.models';

const TYPES: UnitType[] = ['Apartment', 'Apartment', 'Shop', 'Office'];

/** Simule un simple hash pour décider, de façon stable, quelles adresses mock sont des immeubles (une adresse sur 5). */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

@Injectable({ providedIn: 'root' })
export class MockUnitsApiService extends UnitsApiPort {
  override listByAdresse(adresseId: UUID): Observable<AddressUnit[]> {
    const h = hash(adresseId);
    if (h % 5 !== 0) return of([]).pipe(delay(200));

    const unitCount = 2 + (h % 6);
    const units: AddressUnit[] = Array.from({ length: unitCount }, (_, i) => ({
      id: `${adresseId}-unit-${i + 1}`,
      floor: Math.floor(i / 2) + 1,
      number: `${Math.floor(i / 2) + 1}${String.fromCharCode(65 + (i % 2))}`,
      type: TYPES[(h + i) % TYPES.length],
    }));
    return of(units).pipe(delay(200));
  }
}
