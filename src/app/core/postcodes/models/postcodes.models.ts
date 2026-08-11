import { UUID, ISODateTime, PostcodeStatus } from '../../models/das.models';

export interface PostcodeRow {
  id: UUID;
  code: string;             // "PC 1001"
  adminUnitName: string;    // quartier / commune rattaché
  region: string;
  addressCount: number;
  status: PostcodeStatus;   // active | reserved | retired
  issuedAt: ISODateTime;
}

export interface PostcodeMonthly { month: string; count: number; }

export interface PostcodesData {
  rows: PostcodeRow[];
  monthly: PostcodeMonthly[];
  totalIssued: number;
  activeCount: number;
  reservedCount: number;
}

export interface AllocatePostcodePayload {
  code: string;
  adminUnitName: string;
  region: string;
}
