import { Observable } from 'rxjs';
import { UUID } from '../../models/das.models';
import { CreateStaffPayload, SetRolesPayload, StaffListQuery, StaffMember } from '../models/staff.models';

export abstract class StaffApiPort {
  abstract list(query: StaffListQuery): Observable<StaffMember[]>;
  abstract create(payload: CreateStaffPayload): Observable<StaffMember>;
  abstract setRoles(id: UUID, payload: SetRolesPayload): Observable<StaffMember>;
  abstract setActive(id: UUID, isActive: boolean): Observable<StaffMember>;
}
