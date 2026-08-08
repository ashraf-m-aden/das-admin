import { UserRole } from '../../models/das.models';
import { StaffMember } from '../models/staff.models';

export type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type FormStatus = 'idle' | 'saving' | 'error';

export interface StaffFilters {
  search: string;
  role: UserRole | null;
}

export interface StaffState {
  items: StaffMember[];
  listStatus: ListStatus;
  listErrorMessageKey: string | null;
  filters: StaffFilters;
  formStatus: FormStatus;
  formErrorMessageKey: string | null;
}

export const initialStaffState: StaffState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { search: '', role: null },
  formStatus: 'idle',
  formErrorMessageKey: null,
};
