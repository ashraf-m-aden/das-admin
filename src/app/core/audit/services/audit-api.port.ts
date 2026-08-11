import { Observable } from 'rxjs';
import { AuditData, AuditFilters } from '../models/audit.models';

export abstract class AuditApiPort {
  abstract load(filters: AuditFilters): Observable<AuditData>;
}
