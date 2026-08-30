import { UserRole } from '../../models/das.models';
import { AgentProductivity, StaffMember } from '../models/staff.models';

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
  /**
   * Incrémenté à chaque création RÉUSSIE. L'écran s'en sert pour vider son formulaire — un
   * booléen ne conviendrait pas : deux créations successives ne le feraient pas changer de
   * valeur, donc la seconde ne déclencherait rien.
   */
  createTick: number;

  productivity: AgentProductivity[];
  isProductivityLoading: boolean;
  productivityErrorMessageKey: string | null;
}

export const initialStaffState: StaffState = {
  items: [],
  listStatus: 'idle',
  listErrorMessageKey: null,
  filters: { search: '', role: null },
  formStatus: 'idle',
  formErrorMessageKey: null,
  createTick: 0,

  productivity: [],
  isProductivityLoading: false,
  productivityErrorMessageKey: null,
};
