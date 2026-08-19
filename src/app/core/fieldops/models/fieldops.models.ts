import { AssignmentStatus, Campaign, CampaignStatus, UUID } from '../../models/das.models';

export interface CampaignListQuery {
  status: CampaignStatus | null;
}

export interface CreateCampaignPayload {
  name: string;
  /** Date seule (YYYY-MM-DD). */
  deadline: string;
}

export interface StartCampaignResult {
  campaign: Campaign;
  generatedAssignments: number;
}

export interface PopulateCampaignResult {
  campaignId: UUID;
  createdAssignments: number;
  totalAssignments: number;
}

export interface AddCampaignAddressesResult {
  campaignId: UUID;
  added: number;
  alreadyPresent: UUID[];
  notFound: UUID[];
  rejectedUnassignedBloc: UUID[];
}

export interface AssignmentQuery {
  campaignId: UUID | null;
  agentId: UUID | null;
  status: AssignmentStatus | null;
}

export interface TransferBlocsResult {
  fromAgentId: UUID;
  toAgentId: UUID;
  transferredCount: number;
}
