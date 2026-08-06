import { StaffMember } from '../models/staff.models';

export type StaffListStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type StaffFormStatus = 'idle' | 'saving' | 'error';

export interface StaffFilters {
  search: string;
  role: 'admin' | 'supervisor' | 'surveyor' | null;
  status: 'active' | 'suspended' | 'inactive' | null;
}

export interface StaffState {
  items: StaffMember[];
  listStatus: StaffListStatus;
  listErrorMessageKey: string | null;
  filters: StaffFilters;
  formStatus: StaffFormStatus;
  formErrorMessageKey: string | null;
  lastCreatedTemporaryPassword: string | null;
}

export const initialStaffState: StaffState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { search: '', role: null, status: null },
  formStatus: 'idle',
  formErrorMessageKey: null,
  lastCreatedTemporaryPassword: null,
};
