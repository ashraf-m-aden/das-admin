import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { map } from 'rxjs';
import { StaffActions } from './staff.actions';
import { staffFeature } from './staff.reducer';
import { UUID, UserRole } from '../../models/das.models';
import { CreateStaffPayload, SetRolesPayload } from '../models/staff.models';

@Injectable({ providedIn: 'root' })
export class StaffFacade {
  private store = inject(Store);

  items$ = this.store.select(staffFeature.selectItems);
  filters$ = this.store.select(staffFeature.selectFilters);
  isListLoading$ = this.store.select(staffFeature.selectListStatus).pipe(map((s) => s === 'loading'));

  isFormSaving$ = this.store.select(staffFeature.selectFormStatus).pipe(map((s) => s === 'saving'));
  formErrorMessageKey$ = this.store.select(staffFeature.selectFormErrorMessageKey);

  load(): void {
    this.store.dispatch(StaffActions.loadStaff());
  }
  setFilters(search: string, role: UserRole | null): void {
    this.store.dispatch(StaffActions.setFilters({ search, role }));
  }
  create(payload: CreateStaffPayload): void {
    this.store.dispatch(StaffActions.createStaff({ payload }));
  }
  setRoles(id: UUID, payload: SetRolesPayload): void {
    this.store.dispatch(StaffActions.setRoles({ id, payload }));
  }
  setActive(id: UUID, isActive: boolean): void {
    this.store.dispatch(StaffActions.setActive({ id, isActive }));
  }

  productivity$ = this.store.select(staffFeature.selectProductivity);
  isProductivityLoading$ = this.store.select(staffFeature.selectIsProductivityLoading);

  loadProductivity(campaignId: UUID | null = null, agentId: UUID | null = null): void {
    this.store.dispatch(StaffActions.loadProductivity({ campaignId, agentId }));
  }
}
