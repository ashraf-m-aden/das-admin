import { createFeature, createReducer, on } from '@ngrx/store';
import { StaffActions } from './staff.actions';
import { initialStaffState } from './staff.state';

export const staffFeature = createFeature({
  name: 'staff',
  reducer: createReducer(
    initialStaffState,

    on(StaffActions.loadStaff, (state) => ({ ...state, listStatus: 'loading' as const, listErrorMessageKey: null })),
    on(StaffActions.loadStaffSuccess, (state, { items }) => ({ ...state, items, listStatus: 'loaded' as const })),
    on(StaffActions.loadStaffFailure, (state, { errorMessageKey }) => ({
      ...state,
      listStatus: 'error' as const,
      listErrorMessageKey: errorMessageKey,
    })),

    on(StaffActions.setFilters, (state, { filters }) => ({ ...state, filters: { ...state.filters, ...filters } })),

    on(StaffActions.createStaff, StaffActions.updateStaff, (state) => ({
      ...state,
      formStatus: 'saving' as const,
      formErrorMessageKey: null,
    })),

    on(StaffActions.createStaffSuccess, (state, { user, temporaryPassword }) => ({
      ...state,
      items: [...state.items, user],
      formStatus: 'idle' as const,
      lastCreatedTemporaryPassword: temporaryPassword,
    })),

    on(StaffActions.updateStaffSuccess, StaffActions.setEnabledSuccess, (state, { user }) => ({
      ...state,
      items: state.items.map((s) => (s.id === user.id ? user : s)),
      formStatus: 'idle' as const,
    })),

    on(StaffActions.createStaffFailure, StaffActions.updateStaffFailure, (state, { errorMessageKey }) => ({
      ...state,
      formStatus: 'error' as const,
      formErrorMessageKey: errorMessageKey,
    })),

    on(StaffActions.clearTemporaryPassword, (state) => ({ ...state, lastCreatedTemporaryPassword: null })),
  ),
});

export const {
  name: staffFeatureKey,
  reducer: staffReducer,
  selectItems,
  selectListStatus,
  selectListErrorMessageKey,
  selectFilters,
  selectFormStatus,
  selectFormErrorMessageKey,
  selectLastCreatedTemporaryPassword,
} = staffFeature;
