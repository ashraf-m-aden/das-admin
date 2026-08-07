import { UUID, BlockStatus, SubmissionStatus } from '../../models/das.models';

export interface BlockToName {
  id: UUID;
  code: string;
  suggestedName: string | null;
  name: string | null;
  status: BlockStatus;
}

export interface AssignBlockNamePayload {
  name: string;
}

export interface BlockNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

export interface StreetToName {
  id: UUID;
  blockCode: string;
  suggestedName: string | null;
  nameFr: string | null;
  nameAr: string | null;
  /** Référence ROAD_TYPES (créés dans Paramètres) — null tant qu'aucun type n'a été choisi. */
  roadTypeId: UUID | null;
  signPresent: boolean;
  nameVisible: boolean;
  status: SubmissionStatus;
}

export interface AssignStreetNamePayload {
  nameFr: string;
  nameAr: string | null;
  roadTypeId: UUID | null;
}

export interface StreetNamingQuery {
  search: string;
  onlyUnnamed: boolean;
}

export interface AdminHierarchy {
  region: string;
  commune: string;
  arrondissement: string | null;
  quartier: string;
}

export interface PropertyToNumber {
  id: UUID;
  blockCode: string;
  blockName: string | null;
  lotCode: string | null;
  houseNumber: string;

  quartierName: string;
  cityName: string;
  adminHierarchy: AdminHierarchy;

  addressCode: string;
  formattedAddress: string;
  status: SubmissionStatus;
}

export interface AssignHouseNumberPayload {
  houseNumber: string;
}

export interface PropertyNumberingQuery {
  blockId: UUID | null;
}
