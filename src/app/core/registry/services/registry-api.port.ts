import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import {
  AddressDetail, BulkUpdatePayload, RegistryFilterOptions,
  RegistryPageResult, RegistryQuery, RegistrySummary,
} from '../models/registry.models';

export abstract class RegistryApiPort {
  abstract summary(): Observable<RegistrySummary>;
  abstract filterOptions(): Observable<RegistryFilterOptions>;
  abstract list(query: RegistryQuery): Observable<RegistryPageResult>;
  abstract getDetail(id: UUID): Observable<AddressDetail>;
  abstract approve(ids: UUID[]): Observable<void>;
  abstract bulkUpdate(payload: BulkUpdatePayload): Observable<void>;
  abstract flagForReview(id: UUID): Observable<void>;
}
