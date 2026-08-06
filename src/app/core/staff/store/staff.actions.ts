import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { CreateStaffPayload, StaffMember, UpdateStaffPayload } from '../models/staff.models';
import { UUID } from '../../models/das.models';
import { StaffFilters } from './staff.state';

export const StaffActions = createActionGroup({
  source: 'Staff',
  events: {
    'Load Staff': emptyProps(),
    'Load Staff Success': props<{ items: StaffMember[] }>(),
    'Load Staff Failure': props<{ errorMessageKey: string }>(),

    'Set Filters': props<{ filters: Partial<StaffFilters> }>(),

    'Create Staff': props<{ payload: CreateStaffPayload }>(),
    'Create Staff Success': props<{ user: StaffMember; temporaryPassword: string }>(),
    'Create Staff Failure': props<{ errorMessageKey: string }>(),

    'Update Staff': props<{ id: UUID; payload: UpdateStaffPayload }>(),
    'Update Staff Success': props<{ user: StaffMember }>(),
    'Update Staff Failure': props<{ errorMessageKey: string }>(),

    'Set Enabled': props<{ id: UUID; enabled: boolean }>(),
    'Set Enabled Success': props<{ user: StaffMember }>(),
    'Set Enabled Failure': props<{ errorMessageKey: string }>(),

    'Reset Password': props<{ id: UUID }>(),
    'Reset Password Success': props<{ temporaryPassword: string }>(),
    'Reset Password Failure': props<{ errorMessageKey: string }>(),

    'Clear Temporary Password': emptyProps(),
  },
});
