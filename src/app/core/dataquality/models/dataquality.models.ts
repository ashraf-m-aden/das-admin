import { UUID, QualitySeverity, QualityCaseStatus } from '../../models/das.models';

export interface QualityKpis {
  coverageRate: number;        // %
  coverageDelta: number;
  accuracyScore: number;       // /100
  accuracyDelta: number;
  duplicateRate: number;       // %
  duplicateDelta: number;
  openCases: number;
  openCasesDelta: number;
}

export interface QualityRuleRow {
  id: UUID;
  code: string;
  nameKey: string;             // dataquality.rule.<code>.name
  descriptionKey: string;      // dataquality.rule.<code>.desc
  icon: string;                // tabler icon
  enabled: boolean;
  impactedCount: number;
}

export interface QualityAlertRow {
  id: UUID;
  issueTypeKey: string;        // dataquality.issue.<code>
  severity: QualitySeverity;
  quartier: string;
  ruleTriggeredKey: string;    // dataquality.trigger.<code>
  impactedRecords: number;
  assignedReviewer: string | null;
  status: QualityCaseStatus;
}

export interface RegionCoverage { region: string; coveragePct: number; }

export interface DuplicateCandidate {
  id: UUID;
  kind: 'spatial' | 'textual';
  addressA: string;
  addressB: string;
  scorePct: number;            // similarité / recouvrement
  quartier: string;
}

export interface DataQualityData {
  kpis: QualityKpis;
  rules: QualityRuleRow[];
  alerts: QualityAlertRow[];
  regionCoverage: RegionCoverage[];
  duplicates: DuplicateCandidate[];
}
