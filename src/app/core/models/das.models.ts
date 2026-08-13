export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

export interface GeoJSONPoint { type: 'Point'; coordinates: [number, number]; }
export interface GeoJSONLineString { type: 'LineString'; coordinates: [number, number][]; }
export interface GeoJSONPolygon { type: 'Polygon'; coordinates: [number, number][][]; }
export interface GeoJSONMultiPolygon { type: 'MultiPolygon'; coordinates: [number, number][][][]; }
export type GeoJSONPointOrLine = GeoJSONPoint | GeoJSONLineString;

/* =============================================================================
 * HIÉRARCHIE ADMINISTRATIVE — arbre générique
 * Region → Ville → Commune → Quartier   (au-dessus du Bloc)
 * Puis entités concrètes : Bloc → Parcelle (= Adresse). Plus de Lot.
 * ========================================================================== */

export type AdminUnitLevel = 'region' | 'ville' | 'commune' | 'quartier';

export interface AdministrativeUnit {
  id: UUID;
  parentId: UUID | null;
  levelType: AdminUnitLevel;
  code: string;                    // ex. "Q7" pour un quartier
  nameFr: string;
  nameAr: string | null;
  path: string;                    // ltree matérialisé (rattachement + reporting)
  geom: GeoJSONMultiPolygon;
  publicVisible: boolean;
  createdAt: ISODateTime;
}

export type RoadTypeCode = 'street' | 'avenue' | 'boulevard' | 'alley' | 'road' | 'intersection' | 'roundabout';
export interface RoadType { id: UUID; code: RoadTypeCode; labelFr: string; isPoint: boolean; }
export type ZoneStatus = 'active' | 'reserved' | 'retired';

/**
 * Zone postale : regroupe un ENSEMBLE de quartiers et porte le code postal.
 * Orthogonale à la hiérarchie admin (Region→Ville→Commune→Quartier).
 * Un quartier appartient à une seule zone (partition) → code postal non ambigu.
 */
export interface Zone {
  id: UUID;
  name: string;                 // ex. "Zone Boulaos Nord"
  postalCode: string;           // ex. "PC 1001" — porté par la zone
  regionId: UUID | null;
  regionName: string;
  quartierIds: UUID[];          // quartiers couverts par la zone
  status: ZoneStatus;
  createdAt: ISODateTime;
}
export type BlockStatus = 'not_assigned' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'needs_redo';
export interface Block {
  id: UUID;
  adminUnitId: UUID;               // rattaché à l'unité de niveau quartier (calculé à l'import)
  code: string;                    // calculé backend
  /** Nom officiel utilisé dans les adresses (ex: "Avenue Nasser"). Fixé via l'Adressage. */
  name: string | null;
  geom: GeoJSONMultiPolygon;
  areaM2: number;                  // calculé (UTM 38N)
  status: BlockStatus;
  assignedUserId: UUID | null;
  sourceFile: string | null;
  importedBy: UUID | null;
  importedAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* Le niveau LOT est supprimé : la parcelle EST l'adresse (Bloc → Parcelle). */

/* Cycle de vie enrichi (maquettes) : Registered → Surveyed → Verified → Approved → Published */
export type AddressWorkflowStage = 'registered' | 'surveyed' | 'verified' | 'approved' | 'published';
export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'institutional' | 'vacant';
export type OccupancyType = 'occupied' | 'vacant' | 'under_construction' | 'unknown';

/** Statuts de soumission pour la file de vérification (revue terrain). */
export type SubmissionStatus = 'draft' | 'submitted' | 'approved' | 'needs_redo';

/**
 * Parcelle = Adresse. Livrée par l'expert comme un polygone (emprise) ; le
 * backend calcule numero, location, blockId. validationScore et geoConfidence
 * alimentent la revue et les indicateurs de qualité (cf. maquettes).
 */
export interface Property {
  id: UUID;
  blockId: UUID;                   // calculé (ST_Contains parcelle → bloc)
  streetId: UUID | null;
  clientUuid: UUID;
  numero: string;                  // calculé séquentiellement par bloc
  addressCode: string;             // ex. "ADDR-00012345"
  formattedAddress: string;        // composée côté serveur (Parcelle→Bloc→Quartier→…→Region)
  geom: GeoJSONMultiPolygon;       // emprise de la parcelle (fourni)
  location: GeoJSONPoint;          // ST_PointOnSurface (calculé)
  postcode: string | null;
  propertyType: PropertyType;
  occupancyType: OccupancyType;
  buildingUse: string | null;
  ownerName: string | null;
  floorsCount: number | null;
  workflowStage: AddressWorkflowStage;
  status: SubmissionStatus;
  validationScore: number | null;  // 0–100
  geoConfidence: number | null;    // 0–100
  gpsAccuracy: number;
  rejectionReason: string | null;
  notes: string | null;
  submittedBy: UUID;
  reviewedBy: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  syncedAt: ISODateTime | null;
}

export type PropertyPhotoType = 'building_front' | 'door' | 'street_view' | 'house_number_plate' | 'extra';
export interface PropertyPhoto {
  id: UUID; propertyId: UUID; photoType: PropertyPhotoType; s3Key: string;
  fileSizeKb: number; uploadedBy: UUID; uploadedAt: ISODateTime;
}

export interface Street {
  id: UUID; blockId: UUID; nameFr: string | null; nameAr: string | null; roadTypeId: UUID;
  geom: GeoJSONPointOrLine; signPresent: boolean; nameVisible: boolean; suggestedName: string | null;
  status: SubmissionStatus; notes: string | null; submittedBy: UUID; reviewedBy: UUID | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type StreetPhotoType = 'sign' | 'road_view';
export interface StreetPhoto { id: UUID; streetId: UUID; photoType: StreetPhotoType; s3Key: string; uploadedAt: ISODateTime; }

/* =============================================================================
 * OPÉRATIONS TERRAIN — équipes (maquettes Field Operations)
 * ========================================================================== */

export type FieldTeamStatus = 'active' | 'en_route' | 'offline' | 'idle';
export interface FieldTeam {
  id: UUID;
  name: string;                    // ex. "Team Alpha"
  supervisorId: UUID;
  supervisorName: string;
  memberCount: number;
  currentZoneId: UUID | null;
  currentZoneName: string | null;
  progressPercent: number;
  status: FieldTeamStatus;
  deviceOnline: boolean;
}

export type TaskType = 'survey' | 'street_naming' | 'verification' | 'boundary_validation';
export type TaskStatus = 'new' | 'in_progress' | 'awaiting_review' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high';
export interface Task {
  id: UUID; blockId: UUID | null; redoRequestId: UUID | null; type: TaskType;
  title: string; zoneName: string | null; addressCount: number | null;
  assignedTeamId: UUID | null; assignedTeamName: string | null;
  createdBy: UUID; status: TaskStatus; priority: TaskPriority; progressPercent: number;
  deadline: ISODateTime | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type RedoSubmissionType = 'property' | 'street';
export type RedoRequestStatus = 'pending' | 'resolved';
export interface RedoRequest {
  id: UUID; submissionType: RedoSubmissionType; submissionId: UUID; requestedBy: UUID;
  reason: string; status: RedoRequestStatus; deadline: ISODateTime | null;
  createdAt: ISODateTime; resolvedAt: ISODateTime | null;
}

/* =============================================================================
 * CODES POSTAUX (module Postcodes)
 * ========================================================================== */

export type PostcodeStatus = 'active' | 'reserved' | 'retired';
export interface Postcode {
  id: UUID; code: string;          // ex. "PC 1001"
  adminUnitId: UUID; adminUnitName: string;
  addressCount: number; status: PostcodeStatus;
  issuedAt: ISODateTime; createdBy: UUID;
}

/* =============================================================================
 * QUALITÉ DES DONNÉES (module Data Quality)
 * ========================================================================== */

export type QualitySeverity = 'low' | 'medium' | 'high';
export type QualityCaseStatus = 'new' | 'in_review' | 'resolved';
export interface QualityRule {
  id: UUID; code: string; nameKey: string; descriptionKey: string;
  enabled: boolean; impactedCount: number;
}
export interface QualityAlert {
  id: UUID; ruleId: UUID; issueType: string; severity: QualitySeverity;
  adminUnitName: string; ruleTriggered: string; impactedRecords: number;
  assignedReviewer: string | null; status: QualityCaseStatus; createdAt: ISODateTime;
}

export type UserRole = 'Admin' | 'Gestionnaire' | 'Superviseur' | 'AgentTerrain';

export interface User {
  id: UUID;
  fullName: string;
  username: string;
  roles: UserRole[];
  isActive: boolean;
}

export interface AuditLogEntry {
  id: UUID; entityType: string; entityId: UUID; action: string;
  oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null;
  performedBy: UUID; createdAt: ISODateTime;
}

/* =============================================================================
 * COMMERCIAL — conservé en modèle, HORS PÉRIMÈTRE de cette passe (pas d'UI)
 * ========================================================================== */

export type ClientStatus = 'trial' | 'active' | 'suspended';
export interface Client {
  id: UUID; companyName: string; contactName: string; login: string; passwordHash: string;
  email: string; phone: string | null; billingAddress: string | null; taxId: string | null;
  status: ClientStatus; enabled: boolean; planId: UUID; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface SubscriptionPlan {
  id: UUID; name: string; monthlyPrice: number; maxRequestsPerMonth: number; maxZones: number;
  routeGenerationEnabled: boolean; fullMapAccess: boolean; createdAt: ISODateTime;
}

export type ApiTokenStatus = 'active' | 'revoked';
export interface ApiToken {
  id: UUID; clientId: UUID; tokenHash: string; name: string; scopes: string[];
  status: ApiTokenStatus; expiresAt: ISODateTime | null; lastUsedAt: ISODateTime | null;
  createdAt: ISODateTime; revokedAt: ISODateTime | null;
}

export type ZoneAccessStatus = 'granted' | 'blocked';
export interface ClientZoneAccess {
  id: UUID; clientId: UUID; zoneId: UUID; accessStatus: ZoneAccessStatus;
  grantedBy: UUID; grantedAt: ISODateTime; blockedAt: ISODateTime | null;
}

export interface ApiUsageLogEntry {
  id: UUID; tokenId: UUID; endpoint: string; statusCode: number; responseTimeMs: number; requestedAt: ISODateTime;
}

export type TravelMode = 'driving' | 'walking' | 'transit';
export interface RouteRequest {
  id: UUID; clientId: UUID; tokenId: UUID; originPoint: GeoJSONPoint; destinationPoint: GeoJSONPoint;
  routeGeom: GeoJSONLineString; distanceM: number; durationS: number; travelMode: TravelMode; createdAt: ISODateTime;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export interface Invoice {
  id: UUID; clientId: UUID; periodStart: ISODate; periodEnd: ISODate; amountTotal: number;
  currency: string; status: InvoiceStatus; dueDate: ISODate; issuedAt: ISODateTime | null; paidAt: ISODateTime | null;
}

export type BillingUsageType = 'api_call' | 'route_request' | 'zone_access';
export interface BillingRecord {
  id: UUID; clientId: UUID; invoiceId: UUID | null; usageType: BillingUsageType;
  quantity: number; unitPrice: number; amount: number; periodStart: ISODate; periodEnd: ISODate; createdAt: ISODateTime;
}
