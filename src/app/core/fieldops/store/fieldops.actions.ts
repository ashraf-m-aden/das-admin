import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Assignment, Campaign, CampaignBloc, CampaignProgress, UUID } from '../../models/das.models';
import { CreateCampaignPayload, PopulateCampaignResult, StartCampaignResult, TransferBlocsResult } from '../models/fieldops.models';
import { AssignmentFilters, CampaignFilters } from './fieldops.state';

export const FieldOpsActions = createActionGroup({
  source: 'FieldOps',
  events: {
    'Load Campaigns': emptyProps(),
    'Load Campaigns Success': props<{ items: Campaign[] }>(),
    'Load Campaigns Failure': props<{ errorMessageKey: string }>(),
    'Set Campaign Filters': props<{ filters: Partial<CampaignFilters> }>(),

    'Create Campaign': props<{ payload: CreateCampaignPayload }>(),
    'Create Campaign Success': props<{ campaign: Campaign }>(),
    'Create Campaign Failure': props<{ errorMessageKey: string }>(),

    'Update Campaign': props<{ id: UUID; payload: CreateCampaignPayload }>(),
    'Update Campaign Success': props<{ campaign: Campaign }>(),
    'Update Campaign Failure': props<{ errorMessageKey: string }>(),

    'Load Campaign Detail': props<{ id: UUID }>(),
    'Load Campaign Detail Success': props<{ campaign: Campaign }>(),
    'Load Campaign Detail Failure': props<{ errorMessageKey: string }>(),
    'Clear Selected Campaign': emptyProps(),

    'Load Campaign Progress': props<{ id: UUID }>(),
    'Load Campaign Progress Success': props<{ progress: CampaignProgress }>(),
    'Load Campaign Progress Failure': props<{ errorMessageKey: string }>(),

    'Start Campaign': props<{ id: UUID }>(),
    'Start Campaign Success': props<{ result: StartCampaignResult }>(),
    'Start Campaign Failure': props<{ errorMessageKey: string }>(),

    'Populate Campaign': props<{ id: UUID }>(),
    'Populate Campaign Success': props<{ result: PopulateCampaignResult }>(),
    'Populate Campaign Failure': props<{ errorMessageKey: string }>(),

    'Extend Campaign': props<{ id: UUID }>(),
    'Extend Campaign Success': props<{ campaign: Campaign }>(),
    'Extend Campaign Failure': props<{ errorMessageKey: string }>(),

    'Close Campaign': props<{ id: UUID }>(),
    'Close Campaign Success': props<{ campaign: Campaign }>(),
    'Close Campaign Failure': props<{ errorMessageKey: string }>(),

    'Load Campaign Blocs': props<{ campaignId: UUID }>(),
    'Load Campaign Blocs Success': props<{ items: CampaignBloc[] }>(),
    'Load Campaign Blocs Failure': props<{ errorMessageKey: string }>(),

    'Assign Bloc': props<{ campaignId: UUID; blocId: UUID; agentId: UUID }>(),
    'Assign Bloc Success': props<{ campaignBloc: CampaignBloc }>(),
    'Assign Bloc Failure': props<{ errorMessageKey: string }>(),

    'Reassign Bloc': props<{ campaignId: UUID; blocId: UUID; agentId: UUID }>(),
    'Reassign Bloc Success': props<{ campaignBloc: CampaignBloc }>(),
    'Reassign Bloc Failure': props<{ errorMessageKey: string }>(),

    'Transfer Blocs': props<{ fromAgentId: UUID; toAgentId: UUID; campaignId: UUID | null }>(),
    'Transfer Blocs Success': props<{ result: TransferBlocsResult }>(),
    'Transfer Blocs Failure': props<{ errorMessageKey: string }>(),

    'Load Assignments': emptyProps(),
    'Load Assignments Success': props<{ items: Assignment[] }>(),
    'Load Assignments Failure': props<{ errorMessageKey: string }>(),
    'Set Assignment Filters': props<{ filters: Partial<AssignmentFilters> }>(),

    'Abandon Assignment': props<{ id: UUID; abandonReason: string }>(),
    'Abandon Assignment Success': props<{ assignment: Assignment }>(),
    'Abandon Assignment Failure': props<{ errorMessageKey: string }>(),
  },
});
