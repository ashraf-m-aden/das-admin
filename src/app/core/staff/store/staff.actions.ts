import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AgentProductivity, CreateStaffPayload, SetRolesPayload, StaffMember } from '../models/staff.models';
import { UUID, UserRole } from '../../models/das.models';

export const StaffActions = createActionGroup({
  source: 'Staff',
  events: {
    'Load Staff': emptyProps(),
    'Load Staff Success': props<{ items: StaffMember[] }>(),
    'Load Staff Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ search: string; role: UserRole | null }>(),

    'Create Staff': props<{ payload: CreateStaffPayload }>(),
    'Create Staff Success': props<{ user: StaffMember }>(),
    'Create Staff Failure': props<{ errorMessageKey: string }>(),

    'Set Roles': props<{ id: UUID; payload: SetRolesPayload }>(),
    'Set Roles Success': props<{ id: UUID; roles: UserRole[] }>(),
    'Set Roles Failure': props<{ errorMessageKey: string }>(),

    'Set Active': props<{ id: UUID; isActive: boolean }>(),
    'Set Active Success': props<{ id: UUID; isActive: boolean }>(),
    'Set Active Failure': props<{ errorMessageKey: string }>(),

    'Load Productivity': props<{ campaignId: UUID | null; agentId: UUID | null }>(),
    'Load Productivity Success': props<{ items: AgentProductivity[] }>(),
    'Load Productivity Failure': props<{ errorMessageKey: string }>(),
  },
});
