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
  /** Clé de traduction (ex: 'alerts.redo_overdue') — le message final est composé côté template avec messageParams */
  messageKey: string;
  messageParams?: Record<string, string | number>;
  relatedEntityId: UUID;
  createdAt: ISODateTime;
}

export interface DashboardSummary {
  totalProperties: number;
  pendingReview: number;
  approvedRecords: number;
  activeStaff: number;
  zoneProgress: ZoneProgress[];
  urgentAlerts: UrgentAlert[];
}
