import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { AddressUnit } from '../models/units.models';

export abstract class UnitsApiPort {
  abstract listByAdresse(adresseId: UUID): Observable<AddressUnit[]>;
}
