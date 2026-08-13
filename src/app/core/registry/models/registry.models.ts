// en tête, compléter l'import :
import { UUID, ISODateTime, AddressWorkflowStage, PropertyType, OccupancyType, GeoJSONMultiPolygon } from '../../models/das.models';
export interface AddressListItem {
  id: UUID;
  addressCode: string;
  postcode: string | null;
  zone: string | null;        // ← nouveau
  street: string;
  district: string;
  propertyType: PropertyType;
  workflowStage: AddressWorkflowStage;
  lastUpdate: ISODateTime;
  assignedTeamName: string | null;
  geom: GeoJSONMultiPolygon;
}
export interface AddressComponents { street: string; district: string; commune: string; region: string; postcode: string | null; }
export interface AddressLocation { latitude: number; longitude: number; parcelNumber: string; }
export interface AddressPropertyInfo { propertyType: PropertyType; occupancyType: OccupancyType; buildingUse: string | null; }
export interface AddressValidation { score: number; notes: string | null; }
export interface AddressHistoryEntry { id: UUID; actionKey: string; actor: string; at: ISODateTime; }

export type LinkedRecordKind = 'street' | 'postcode' | 'block' | 'team';
export interface LinkedRecord { id: UUID; kind: LinkedRecordKind; label: string; }

export interface AddressDetail extends AddressListItem {
  components: AddressComponents;
  location: AddressLocation;
  propertyInfo: AddressPropertyInfo;
  validation: AddressValidation;
  history: AddressHistoryEntry[];
  linked: LinkedRecord[];
}

export interface RegistryFilters {
  search: string;
  postcode: string | null;
  region: string | null;
  status: AddressWorkflowStage | null;
  team: string | null;
}

export interface RegistryFilterOptions {
  postcodes: string[];
  regions: string[];
  teams: string[];
}

export interface RegistrySummary {
  totalRecords: number;
  pendingReview: number;
  duplicatesFlagged: number;
  publishedToday: number;
}

export interface RegistryPageResult {
  items: AddressListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RegistryQuery {
  filters: RegistryFilters;
  page: number;
  pageSize: number;
}

export interface BulkUpdatePayload {
  ids: UUID[];
  team?: string | null;
  stage?: AddressWorkflowStage;
}

export const WORKFLOW_STAGES: AddressWorkflowStage[] = ['registered', 'surveyed', 'verified', 'approved', 'published'];
export interface AddressComponents {
  street: string;
  district: string;      // quartier
  zone: string;          // zone postale (regroupe des quartiers)
  commune: string;
  region: string;
  postcode: string | null;
}
export interface RegistryFilters {
  search: string;
  postcode: string | null;
  zone: string | null;        // ← nouveau
  region: string | null;
  status: AddressWorkflowStage | null;
  team: string | null;
}

export interface RegistryFilterOptions {
  postcodes: string[];
  zones: string[];            // ← nouveau
  regions: string[];
  teams: string[];
}
