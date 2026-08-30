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
      ...state, listStatus: 'error' as const, listErrorMessageKey: errorMessageKey,
    })),

    on(StaffActions.setFilters, (state, { search, role }) => ({ ...state, filters: { search, role } })),

    on(StaffActions.createStaff, (state) => ({ ...state, formStatus: 'saving' as const, formErrorMessageKey: null })),
    on(StaffActions.createStaffSuccess, (state, { user }) => ({
      ...state, items: [...state.items, user], formStatus: 'idle' as const,
      formErrorMessageKey: null, createTick: state.createTick + 1,
    })),
    on(StaffActions.createStaffFailure, (state, { errorMessageKey }) => ({
      ...state, formStatus: 'error' as const, formErrorMessageKey: errorMessageKey,
    })),

    on(StaffActions.setRolesSuccess, (state, { id, roles }) => ({
      ...state, items: state.items.map((s) => (s.id === id ? { ...s, roles } : s)),
    })),
    on(StaffActions.setActiveSuccess, (state, { id, isActive }) => ({
      ...state, items: state.items.map((s) => (s.id === id ? { ...s, isActive } : s)),
    })),

    on(StaffActions.loadProductivity, (state) => ({
      ...state, isProductivityLoading: true, productivityErrorMessageKey: null,
    })),
    on(StaffActions.loadProductivitySuccess, (state, { items }) => ({
      ...state, productivity: items, isProductivityLoading: false,
    })),
    on(StaffActions.loadProductivityFailure, (state, { errorMessageKey }) => ({
      ...state, isProductivityLoading: false, productivityErrorMessageKey: errorMessageKey,
    })),
  ),
});

export const {
  name: staffFeatureKey,
  reducer: staffReducer,
  selectItems, selectListStatus, selectListErrorMessageKey, selectFilters,
  selectFormStatus, selectFormErrorMessageKey,
  selectProductivity, selectIsProductivityLoading, selectProductivityErrorMessageKey,
} = staffFeature;
