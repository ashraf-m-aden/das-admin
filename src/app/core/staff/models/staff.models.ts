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

/** Ventilation par statut — toujours renvoyée, jamais un filtre (`GET /api/surveys/productivity`). */
export interface ProductivityByStatus {
  draft: number;
  submitted: number;
  validated: number;
  rejected: number;
}

/** Une ligne (campagne, agent) — la période est celle de la campagne, aucun filtre de dates. */
export interface AgentProductivity {
  campaignId: UUID;
  campaignCode: string;
  campaignName: string;
  agentId: UUID;
  agentFullName: string;
  total: number;
  byStatus: ProductivityByStatus;
}
