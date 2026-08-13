import { ISODateTime } from '../../models/das.models';

export type AuditAction = 'created' | 'updated' | 'approved' | 'rejected' | 'published' | 'deleted' | 'login';

export interface AuditRow {
  id: string;
  action: AuditAction;
  entityType: string;      // "Address", "Block", "Postcode"…
  entityLabel: string;     // "ADDR-00012345"
  actor: string;
  at: ISODateTime;
}

export interface AuditFilters { search: string; action: AuditAction | null; from?: string; to?: string; }
export interface AuditData { rows: AuditRow[]; total: number; }
