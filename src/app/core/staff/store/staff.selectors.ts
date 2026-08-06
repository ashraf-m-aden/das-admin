import { createSelector } from '@ngrx/store';
import { staffFeature } from './staff.reducer';

export const selectIsStaffListLoading = createSelector(
  staffFeature.selectListStatus,
  (status) => status === 'loading',
);

export const selectIsStaffFormSaving = createSelector(
  staffFeature.selectFormStatus,
  (status) => status === 'saving',
);

export const selectStaffById = (id: string) =>
  createSelector(staffFeature.selectItems, (items) => items.find((s) => s.id === id) ?? null);
