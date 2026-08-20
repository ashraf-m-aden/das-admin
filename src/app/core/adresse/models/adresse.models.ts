import {
  UUID, ISODateTime, AddressWorkflowStage, OccupancyType, GeoJSONMultiPolygon,
} from '../../models/das.models';

/**
 * Ligne du registre des adresses.
 * Rappel domaine : `postcode` appartient au QUARTIER de l'adresse ; `zone`
 * est la zone (postale) qui regroupe des quartiers.
 * `geom` est toujours `null` côté API réelle (la carte vient des tuiles Martin) ;
 * seul le mock le peuple pour simuler un overlay carte hors `useMockApi()`.
 */
export interface AddressListItem {
  id: UUID;
  addressCode: string;
  postcode: string | null;   // code postal du quartier de l'adresse
  zone: string | null;       // zone (regroupe des quartiers)
  quartier: string;
  propertyType: string;      // libellé FR d'un catalogue back, pas un enum fermé — à afficher brut
  workflowStage: AddressWorkflowStage;
  lastUpdate: ISODateTime;
  assignedTeamName: string | null;
  geom: GeoJSONMultiPolygon;
}

/** Composantes hiérarchiques d'une adresse (fiche détail). */
export interface AddressComponents {
  quartierNom: string;   // le back envoie `quartierNom` (pas `quartier`)
  zone: string;          // zone (regroupe des quartiers)
  commune: string;
  region: string;
  postcode: string | null;
}

export interface AddressLocation {
  latitude: number;
  longitude: number;
  parcelNumber: string;  // = le `numero` de l'adresse (même donnée, pas un champ séparé)
}
export interface AddressPropertyInfo { propertyType: string; occupancyType: OccupancyType; buildingUse: string | null; }
export interface AddressValidation { score: number; notes: string | null; }

export type LinkedRecordKind = 'postcode' | 'block' | 'team';
export interface LinkedRecord { id: UUID; kind: LinkedRecordKind; label: string; }

/** Adresse enrichie pour le tiroir de détail (details / linked). Pas d'onglet historique : `history` toujours vide côté back. */
export interface AddressDetail extends AddressListItem {
  components: AddressComponents;
  location: AddressLocation;
  propertyInfo: AddressPropertyInfo;
  validation: AddressValidation;
  linked: LinkedRecord[];
}

/** Filtres du registre. Déclaration UNIQUE (fin des doublons). */
export interface AdresseFilters {
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
export interface AdresseFilterOptions {
  postcodes: string[];
  zones: string[];
  regions: string[];
  teams: string[];
}

/** Une des 5 étapes, toujours renvoyée même à 0 — la somme des `count` vaut exactement `totalRecords`. */
export interface WorkflowStageCount {
  stage: AddressWorkflowStage;
  count: number;
}

export interface AdresseSummary {
  totalRecords: number;
  pendingReview: number;
  duplicatesFlagged: number;
  publishedToday: number;
  workflowBreakdown: WorkflowStageCount[];
}

export interface AdressePageResult {
  items: AddressListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdresseQuery {
  filters: AdresseFilters;
  page: number;
  pageSize: number;
}

/** `PATCH /bulk` : casse PascalCase obligatoire, uniquement Approved | Published (pas de changement d'équipe en masse). */
export interface BulkUpdatePayload {
  ids: UUID[];
  stage: 'Approved' | 'Published';
}

export const WORKFLOW_STAGES: AddressWorkflowStage[] = ['registered', 'surveyed', 'verified', 'approved', 'published'];
