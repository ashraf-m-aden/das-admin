import { Observable } from 'rxjs';
import {
  CreateStaffPayload,
  CreateStaffResult,
  ResetPasswordResult,
  StaffListQuery,
  StaffMember,
  UpdateStaffPayload,
} from '../models/staff.models';
import { UUID } from '../../models/das.models';

export abstract class StaffApiPort {
  abstract list(query: StaffListQuery): Observable<StaffMember[]>;
  abstract create(payload: CreateStaffPayload): Observable<CreateStaffResult>;
  abstract update(id: UUID, payload: UpdateStaffPayload): Observable<StaffMember>;
  abstract setEnabled(id: UUID, enabled: boolean): Observable<StaffMember>;
  abstract resetPassword(id: UUID): Observable<ResetPasswordResult>;
}
