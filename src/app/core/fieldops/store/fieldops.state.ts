import { Assignment, AssignmentStatus, Campaign, CampaignBloc, CampaignProgress, CampaignStatus, UUID } from '../../models/das.models';
import { PopulateCampaignResult, TransferBlocsResult } from '../models/fieldops.models';

export type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface CampaignFilters {
  status: CampaignStatus | null;
}

export interface AssignmentFilters {
  campaignId: UUID | null;
  agentId: UUID | null;
  status: AssignmentStatus | null;
}

export interface FieldOpsState {
  campaigns: Campaign[];
  campaignsStatus: ListStatus;
  campaignsErrorMessageKey: string | null;
  campaignFilters: CampaignFilters;
  isCreatingCampaign: boolean;
  createCampaignErrorMessageKey: string | null;

  isUpdatingCampaign: boolean;
  updateCampaignErrorMessageKey: string | null;

  selectedCampaign: Campaign | null;
  selectedCampaignStatus: ListStatus;

  progress: CampaignProgress | null;
  progressStatus: ListStatus;

  isStarting: boolean;
  startErrorMessageKey: string | null;

  isPopulating: boolean;
  populateErrorMessageKey: string | null;
  lastPopulateResult: PopulateCampaignResult | null;

  isExtending: boolean;
  extendErrorMessageKey: string | null;

  isClosing: boolean;
  closeErrorMessageKey: string | null;

  campaignBlocs: CampaignBloc[];
  campaignBlocsStatus: ListStatus;
  isAssigningBloc: boolean;
  assignBlocErrorMessageKey: string | null;
  decidingBlocId: UUID | null;

  isTransferringBlocs: boolean;
  transferBlocsErrorMessageKey: string | null;
  lastTransferResult: TransferBlocsResult | null;

  assignments: Assignment[];
  assignmentsStatus: ListStatus;
  assignmentFilters: AssignmentFilters;
  decidingAssignmentId: UUID | null;
  assignmentActionErrorMessageKey: string | null;
}

export const initialFieldOpsState: FieldOpsState = {
  campaigns: [],
  campaignsStatus: 'idle',
  campaignsErrorMessageKey: null,
  campaignFilters: { status: null },
  isCreatingCampaign: false,
  createCampaignErrorMessageKey: null,

  isUpdatingCampaign: false,
  updateCampaignErrorMessageKey: null,

  selectedCampaign: null,
  selectedCampaignStatus: 'idle',

  progress: null,
  progressStatus: 'idle',

  isStarting: false,
  startErrorMessageKey: null,

  isPopulating: false,
  populateErrorMessageKey: null,
  lastPopulateResult: null,

  isExtending: false,
  extendErrorMessageKey: null,

  isClosing: false,
  closeErrorMessageKey: null,

  campaignBlocs: [],
  campaignBlocsStatus: 'idle',
  isAssigningBloc: false,
  assignBlocErrorMessageKey: null,
  decidingBlocId: null,

  isTransferringBlocs: false,
  transferBlocsErrorMessageKey: null,
  lastTransferResult: null,

  assignments: [],
  assignmentsStatus: 'idle',
  assignmentFilters: { campaignId: null, agentId: null, status: null },
  decidingAssignmentId: null,
  assignmentActionErrorMessageKey: null,
};
