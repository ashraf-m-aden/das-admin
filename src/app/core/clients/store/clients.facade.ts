import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { ClientsActions } from './clients.actions';
import { clientsFeature } from './clients.reducer';
import {
  selectClientById,
  selectIsApiTokenLoading,
  selectIsFormSaving,
  selectIsListLoading,
  selectIsZoneAccessLoading,
} from './clients.selectors';
import { UUID } from '../../models/das.models';
import {
  CreateApiTokenPayload,
  CreateClientPayload,
  GrantZoneAccessPayload,
  UpdateClientPayload,
} from '../models/clients.models';
import { ClientFilters } from './clients.state';

@Injectable({ providedIn: 'root' })
export class ClientsFacade {
  private store = inject(Store);

  items$ = this.store.select(clientsFeature.selectItems);
  filters$ = this.store.select(clientsFeature.selectFilters);
  isListLoading$ = this.store.select(selectIsListLoading);
  listErrorMessageKey$ = this.store.select(clientsFeature.selectListErrorMessageKey);

  plans$ = this.store.select(clientsFeature.selectPlans);

  isFormSaving$ = this.store.select(selectIsFormSaving);
  formErrorMessageKey$ = this.store.select(clientsFeature.selectFormErrorMessageKey);
  lastCreatedTemporaryPassword$ = this.store.select(clientsFeature.selectLastCreatedTemporaryPassword);

  zoneAccess$ = this.store.select(clientsFeature.selectZoneAccess);
  isZoneAccessLoading$ = this.store.select(selectIsZoneAccessLoading);
  availableZones$ = this.store.select(clientsFeature.selectAvailableZones);
  zoneAccessErrorMessageKey$ = this.store.select(clientsFeature.selectZoneAccessErrorMessageKey);

  apiToken$ = this.store.select(clientsFeature.selectApiToken);
  isApiTokenLoading$ = this.store.select(selectIsApiTokenLoading);
  isSavingToken$ = this.store.select(clientsFeature.selectIsSavingToken);
  apiTokenErrorMessageKey$ = this.store.select(clientsFeature.selectApiTokenErrorMessageKey);
  lastCreatedRawToken$ = this.store.select(clientsFeature.selectLastCreatedRawToken);

  load(): void {
    this.store.dispatch(ClientsActions.loadList());
  }
  setFilters(filters: Partial<ClientFilters>): void {
    this.store.dispatch(ClientsActions.setFilters({ filters }));
  }
  loadPlans(): void {
    this.store.dispatch(ClientsActions.loadPlans());
  }
  getById$(id: UUID) {
    return this.store.select(selectClientById(id));
  }
  create(payload: CreateClientPayload): void {
    this.store.dispatch(ClientsActions.createClient({ payload }));
  }
  update(id: UUID, payload: UpdateClientPayload): void {
    this.store.dispatch(ClientsActions.updateClient({ id, payload }));
  }
  setEnabled(id: UUID, enabled: boolean): void {
    this.store.dispatch(ClientsActions.setEnabled({ id, enabled }));
  }
  clearTemporaryPassword(): void {
    this.store.dispatch(ClientsActions.clearTemporaryPassword());
  }

  loadZoneAccess(clientId: UUID): void {
    this.store.dispatch(ClientsActions.loadZoneAccess({ clientId }));
  }
  loadAvailableZones(): void {
    this.store.dispatch(ClientsActions.loadAvailableZones());
  }
  grantZoneAccess(clientId: UUID, payload: GrantZoneAccessPayload): void {
    this.store.dispatch(ClientsActions.grantZoneAccess({ clientId, payload }));
  }
  revokeZoneAccess(clientId: UUID, zoneAccessId: UUID): void {
    this.store.dispatch(ClientsActions.revokeZoneAccess({ clientId, zoneAccessId }));
  }

  loadApiToken(clientId: UUID): void {
    this.store.dispatch(ClientsActions.loadApiToken({ clientId }));
  }
  regenerateApiToken(clientId: UUID, payload: CreateApiTokenPayload): void {
    this.store.dispatch(ClientsActions.regenerateApiToken({ clientId, payload }));
  }
  clearLastCreatedToken(): void {
    this.store.dispatch(ClientsActions.clearLastCreatedToken());
  }
  revokeApiToken(clientId: UUID): void {
    this.store.dispatch(ClientsActions.revokeApiToken({ clientId }));
  }
}
