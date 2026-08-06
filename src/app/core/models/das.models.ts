export type UUID = string;
export type ISODateTime = string;
export type ISODate = string;

export interface GeoJSONPoint { type: 'Point'; coordinates: [number, number]; }
export interface GeoJSONLineString { type: 'LineString'; coordinates: [number, number][]; }
export interface GeoJSONPolygon { type: 'Polygon'; coordinates: [number, number][][]; }
export type GeoJSONPointOrLine = GeoJSONPoint | GeoJSONLineString;

export type AdminUnitLevel = 'country' | 'region' | 'commune' | 'sub_prefecture' | 'arrondissement' | 'quartier';

export interface AdministrativeUnit {
  id: UUID; parentId: UUID | null; levelType: AdminUnitLevel; code: string;
  nameFr: string; nameAr: string; path: string; geomPolygon: GeoJSONPolygon;
  publicVisible: boolean; createdAt: ISODateTime;
}

export type RoadTypeCode = 'street' | 'avenue' | 'boulevard' | 'alley' | 'road' | 'intersection' | 'roundabout';
export interface RoadType { id: UUID; code: RoadTypeCode; labelFr: string; isPoint: boolean; }

export type BlockStatus = 'not_assigned' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'needs_redo';
export interface Block {
  id: UUID; adminUnitId: UUID; code: string; geomPolygon: GeoJSONPolygon; areaM2: number;
  status: BlockStatus; assignedUserId: UUID | null; sourceFile: string | null;
  importedBy: UUID | null; importedAt: ISODateTime; updatedAt: ISODateTime;
}

export type LotPlannedType = 'residential' | 'commercial' | 'mixed';
export type LotStatus = 'planned' | 'in_progress' | 'completed';
export interface Lot {
  id: UUID; blockId: UUID; code: string; plannedType: LotPlannedType;
  plannedUnitCount: number; actualUnitCount: number; status: LotStatus; createdAt: ISODateTime;
}

export type PropertyType = 'residential' | 'commercial' | 'industrial' | 'vacant';
export type SubmissionStatus = 'draft' | 'submitted' | 'approved' | 'needs_redo';
export interface Property {
  id: UUID; blockId: UUID; lotId: UUID | null; streetId: UUID | null; clientUuid: UUID;
  geomPoint: GeoJSONPoint; houseNumber: string; addressCode: string; formattedAddress: string;
  postcode: string | null; propertyType: PropertyType; ownerName: string | null;
  floorsCount: number | null; status: SubmissionStatus; gpsAccuracy: number;
  rejectionReason: string | null; notes: string | null; submittedBy: UUID; reviewedBy: UUID | null;
  createdAt: ISODateTime; updatedAt: ISODateTime; syncedAt: ISODateTime | null;
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

export type TaskType = 'survey' | 'street_naming';
export type TaskStatus = 'not_started' | 'in_progress' | 'submitted' | 'completed';
export type TaskPriority = 'low' | 'normal' | 'high';
export interface Task {
  id: UUID; blockId: UUID; redoRequestId: UUID | null; type: TaskType; assignedTo: UUID;
  createdBy: UUID; status: TaskStatus; priority: TaskPriority; deadline: ISODateTime | null;
  createdAt: ISODateTime; updatedAt: ISODateTime;
}

export type RedoSubmissionType = 'property' | 'street';
export type RedoRequestStatus = 'pending' | 'resolved';
export interface RedoRequest {
  id: UUID; submissionType: RedoSubmissionType; submissionId: UUID; requestedBy: UUID;
  reason: string; status: RedoRequestStatus; deadline: ISODateTime | null;
  createdAt: ISODateTime; resolvedAt: ISODateTime | null;
}

export type UserRole = 'admin' | 'supervisor' | 'surveyor';
export type UserStatus = 'active' | 'suspended' | 'inactive';
export interface User {
  id: UUID; login: string; passwordHash: string; email: string; phone: string | null;
  firstName: string; lastName: string; role: UserRole; status: UserStatus; enabled: boolean;
  profilePhotoUrl: string | null; lastLoginAt: ISODateTime | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}

export interface AuditLogEntry {
  id: UUID; entityType: string; entityId: UUID; action: string;
  oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null;
  performedBy: UUID; createdAt: ISODateTime;
}

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
