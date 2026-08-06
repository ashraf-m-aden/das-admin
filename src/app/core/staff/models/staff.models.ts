import { UUID, ISODateTime, UserRole, UserStatus } from '../../models/das.models';

/**
 * Vue "personnel" d'un utilisateur — ne contient jamais passwordHash.
 * (User dans das.models.ts reste le miroir complet du schéma DB, réservé
 * aux échanges internes API ; StaffMember est ce que le frontend manipule.)
 */
export interface StaffMember {
  id: UUID;
  login: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  enabled: boolean;
  profilePhotoUrl: string | null;
  lastLoginAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface StaffListQuery {
  search: string;
  role: UserRole | null;
  status: UserStatus | null;
}

export interface CreateStaffPayload {
  login: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export type UpdateStaffPayload = Omit<CreateStaffPayload, 'login'>;

/** Le mot de passe temporaire n'est renvoyé qu'une fois, à la création — jamais stocké. */
export interface CreateStaffResult {
  user: StaffMember;
  temporaryPassword: string;
}

export interface ResetPasswordResult {
  temporaryPassword: string;
}
