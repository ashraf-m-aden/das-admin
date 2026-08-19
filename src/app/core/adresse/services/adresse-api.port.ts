import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, BulkUpdatePayload, AdresseFilterOptions,
  AdressePageResult, AdresseQuery, AdresseSummary,
} from '../models/adresse.models';

export abstract class AdresseApiPort {
  abstract summary(): Observable<AdresseSummary>;
  abstract filterOptions(): Observable<AdresseFilterOptions>;
  abstract list(query: AdresseQuery): Observable<AdressePageResult>;
  abstract getDetail(id: UUID): Observable<AddressDetail>;
  abstract bulkUpdate(payload: BulkUpdatePayload): Observable<void>;
}
