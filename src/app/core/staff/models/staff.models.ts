import { UUID, UserRole } from '../../models/das.models';

export interface StaffMember {
  id: UUID;
  fullName: string;
  username: string;
  roles: UserRole[];
  isActive: boolean;
}

export interface StaffListQuery {
  search: string;
  role: UserRole | null;
}

export interface CreateStaffPayload {
  fullName: string;
  username: string;
  password: string;
  roles: UserRole[];
}

export interface SetRolesPayload {
  roles: UserRole[];
}
