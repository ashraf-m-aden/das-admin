import {
  UUID, ISODateTime, AddressWorkflowStage, PropertyType, OccupancyType, GeoJSONMultiPolygon,
} from '../../models/das.models';

/**
 * Ligne du registre des adresses.
 * Rappel domaine : `postcode` appartient au QUARTIER de l'adresse ; `zone`
 * est la zone (postale) qui regroupe des quartiers. `geom` = emprise de la
 * parcelle (l'adresse), servie pour l'overlay carte.
 */
export interface AddressListItem {
  id: UUID;
  addressCode: string;
  postcode: string | null;   // code postal du quartier de l'adresse
  zone: string | null;       // zone (regroupe des quartiers)
  street: string;
  quartier: string;
  propertyType: PropertyType;
  workflowStage: AddressWorkflowStage;
  lastUpdate: ISODateTime;
  assignedTeamName: string | null;
  geom: GeoJSONMultiPolygon;
}

/** Composantes hiérarchiques d'une adresse (fiche détail). */
export interface AddressComponents {
  street: string;
  quartier: string;      // quartier
  zone: string;          // zone (regroupe des quartiers)
  commune: string;
  region: string;
  postcode: string | null;
}

export interface AddressLocation { latitude: number; longitude: number; parcelNumber: string; }
export interface AddressPropertyInfo { propertyType: PropertyType; occupancyType: OccupancyType; buildingUse: string | null; }
export interface AddressValidation { score: number; notes: string | null; }
export interface AddressHistoryEntry { id: UUID; actionKey: string; actor: string; at: ISODateTime; }

export type LinkedRecordKind = 'street' | 'postcode' | 'block' | 'team';
export interface LinkedRecord { id: UUID; kind: LinkedRecordKind; label: string; }

/** Adresse enrichie pour le tiroir de détail (details / history / linked). */
export interface AddressDetail extends AddressListItem {
  components: AddressComponents;
  location: AddressLocation;
  propertyInfo: AddressPropertyInfo;
  validation: AddressValidation;
  history: AddressHistoryEntry[];
  linked: LinkedRecord[];
}

/** Filtres du registre. Déclaration UNIQUE (fin des doublons). */
export interface RegistryFilters {
  search: string;
  postcode: string | null;   // conservé (inutilisé) — filtrage géo déplacé vers la hiérarchie
  zone: string | null;       // idem
  region: string | null;     // idem
  status: AddressWorkflowStage | null;
  team: string | null;
  cityId: UUID | null;
  communeId: UUID | null;
  zoneId: UUID | null;
  quartierId: UUID | null;
  blocId: UUID | null;
}

/** Options de filtre alimentant les selects. Déclaration UNIQUE. */
export interface RegistryFilterOptions {
  postcodes: string[];
  zones: string[];
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
