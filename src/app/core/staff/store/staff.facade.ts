import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { StaffActions } from './staff.actions';
import { staffFeature } from './staff.reducer';
import { selectIsStaffFormSaving, selectIsStaffListLoading, selectStaffById } from './staff.selectors';
import { CreateStaffPayload, UpdateStaffPayload } from '../models/staff.models';
import { UUID } from '../../models/das.models';
import { StaffFilters } from './staff.state';

@Injectable({ providedIn: 'root' })
export class StaffFacade {
  private store = inject(Store);

  items$ = this.store.select(staffFeature.selectItems);
  filters$ = this.store.select(staffFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsStaffListLoading);
  listErrorMessageKey$ = this.store.select(staffFeature.selectListErrorMessageKey);

  isFormSaving$ = this.store.select(selectIsStaffFormSaving);
  formErrorMessageKey$ = this.store.select(staffFeature.selectFormErrorMessageKey);
  lastCreatedTemporaryPassword$ = this.store.select(staffFeature.selectLastCreatedTemporaryPassword);

  load(): void {
    this.store.dispatch(StaffActions.loadStaff());
  }

  setFilters(filters: Partial<StaffFilters>): void {
    this.store.dispatch(StaffActions.setFilters({ filters }));
  }

  getById$(id: UUID) {
    return this.store.select(selectStaffById(id));
  }

  create(payload: CreateStaffPayload): void {
    this.store.dispatch(StaffActions.createStaff({ payload }));
  }

  update(id: UUID, payload: UpdateStaffPayload): void {
    this.store.dispatch(StaffActions.updateStaff({ id, payload }));
  }

  setEnabled(id: UUID, enabled: boolean): void {
    this.store.dispatch(StaffActions.setEnabled({ id, enabled }));
  }

  resetPassword(id: UUID): void {
    this.store.dispatch(StaffActions.resetPassword({ id }));
  }

  clearTemporaryPassword(): void {
    this.store.dispatch(StaffActions.clearTemporaryPassword());
  }
}
