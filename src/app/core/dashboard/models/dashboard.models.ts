import { AddressWorkflowStage, GeoJSONPoint } from '../../models/das.models';

export interface KpiDelta { value: number; direction: 'up' | 'down' | 'flat'; }

export interface DashboardKpis {
  totalProperties: number; totalPropertiesDelta: KpiDelta;
  verifiedAddresses: number; verifiedPct: number;
  pendingVerification: number; pendingPct: number;
  activeFieldTeams: number; teamsInField: number;
  newPostcodes: number; newPostcodesDelta: KpiDelta;
  dataQualityAlerts: number;
}
export interface MapAddressPoint { id: string; location: GeoJSONPoint; stage: AddressWorkflowStage; }
export interface WorkflowStageCount { stage: AddressWorkflowStage; count: number; percent: number; }
export interface HierarchyLevelCount { levelKey: string; count: number; }
export interface TrendPoint { label: string; value: number; }
export interface VerificationBreakdown { verified: number; pending: number; unverified: number; }

export type ActivityKind = 'batch_approved' | 'postcode_created' | 'survey_uploaded' | 'duplicate_flagged' | 'published' | 'quality_rule';
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  titleKey: string;
  descriptionKey: string;
  params?: Record<string, unknown>;
  at: string;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  workflow: WorkflowStageCount[];
  hierarchy: HierarchyLevelCount[];
  registrationsTrend: TrendPoint[];
  verification: VerificationBreakdown;
  recentActivity: ActivityItem[];
  mapPoints: MapAddressPoint[];
}
