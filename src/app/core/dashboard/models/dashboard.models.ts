import { UUID, ISODateTime } from '../../models/das.models';

export interface ZoneProgress {
  zoneId: UUID;
  zoneName: string;
  approvedCount: number;
  totalCount: number;
}

export type UrgentAlertType = 'redo_overdue' | 'task_overdue' | 'block_stalled';
export type UrgentAlertSeverity = 'high' | 'medium';

export interface UrgentAlert {
  id: UUID;
  type: UrgentAlertType;
  severity: UrgentAlertSeverity;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  relatedEntityId: UUID;
  createdAt: ISODateTime;
}

export type BlockStatus =
  | 'not_assigned'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'needs_redo';

export interface BlockStatusCount {
  status: BlockStatus;
  count: number;
}

export interface WeeklyCollection {
  weekLabel: string;
  count: number;
}

export type ClientAccountStatus = 'active' | 'trial' | 'suspended';

export interface ClientApiConsumption {
  clientId: UUID;
  clientName: string;
  initials: string;
  calls: number;
  status: ClientAccountStatus;
}

export interface DashboardSummary {
  blocksTotal: number;
  streetsRegistered: number;
  areaCoveredKm2: number;
  addressesRegistered: number;

  activeClients: number;
  trialClients: number;
  apiCalls30d: number;

  blocksByStatus: BlockStatusCount[];
  weeklyCollections: WeeklyCollection[];
  apiConsumptionByClient: ClientApiConsumption[];
  zoneProgress: ZoneProgress[];

  totalProperties: number;
  pendingReview: number;
  approvedRecords: number;
  activeStaff: number;
  urgentAlerts: UrgentAlert[];
}
