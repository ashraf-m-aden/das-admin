import { GeoJSONMultiPolygon } from "../../models/das.models";

export interface GrowthPoint { label: string; total: number; verified: number; }
export interface RegionalCompletion { region: string; completionPct: number; }
export interface TurnaroundPoint { label: string; days: number; }

export interface ReportsKpis {
  coverageRate: number; coverageDelta: number;
  accuracyScore: number; accuracyDelta: number;
  verificationSla: number; slaDelta: number;
  avgTurnaroundDays: number;
}

export type ReportExportFormat = 'csv' | 'pdf' | 'xlsx';
export interface RegionShape { region: string; completionPct: number; geom: GeoJSONMultiPolygon; }
export interface ReportsData {
  kpis: ReportsKpis;
  growth: GrowthPoint[];
  regional: RegionalCompletion[];
  turnaround: TurnaroundPoint[];
  totalAddresses: number;
  verifiedAddresses: number;
  regionShapes: RegionShape[];
}
