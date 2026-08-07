import { createFeature, createReducer, on } from '@ngrx/store';
import { ClientsActions } from './clients.actions';
import { initialClientsState } from './clients.state';

export const clientsFeature = createFeature({
  name: 'clients',
  reducer: createReducer(
    initialClientsState,

    on(ClientsActions.loadList, (state) => ({ ...state, listStatus: 'loading' as const, listErrorMessageKey: null })),
    on(ClientsActions.loadListSuccess, (state, { items }) => ({ ...state, items, listStatus: 'loaded' as const })),
    on(ClientsActions.loadListFailure, (state, { errorMessageKey }) => ({
      ...state, listStatus: 'error' as const, listErrorMessageKey: errorMessageKey,
    })),
    on(ClientsActions.setFilters, (state, { filters }) => ({ ...state, filters: { ...state.filters, ...filters } })),

    on(ClientsActions.loadPlansSuccess, (state, { items }) => ({ ...state, plans: items })),

    on(ClientsActions.createClient, ClientsActions.updateClient, (state) => ({
      ...state, formStatus: 'saving' as const, formErrorMessageKey: null,
    })),
    on(ClientsActions.createClientSuccess, (state, { client, temporaryPassword }) => ({
      ...state, items: [...state.items, client], formStatus: 'idle' as const, lastCreatedTemporaryPassword: temporaryPassword,
    })),
    on(ClientsActions.updateClientSuccess, ClientsActions.setEnabledSuccess, (state, { client }) => ({
      ...state, items: state.items.map((c) => (c.id === client.id ? client : c)), formStatus: 'idle' as const,
    })),
    on(ClientsActions.createClientFailure, ClientsActions.updateClientFailure, (state, { errorMessageKey }) => ({
      ...state, formStatus: 'error' as const, formErrorMessageKey: errorMessageKey,
    })),
    on(ClientsActions.clearTemporaryPassword, (state) => ({ ...state, lastCreatedTemporaryPassword: null })),

    on(ClientsActions.loadZoneAccess, (state) => ({ ...state, zoneAccessStatus: 'loading' as const, zoneAccessErrorMessageKey: null })),
    on(ClientsActions.loadZoneAccessSuccess, (state, { items }) => ({ ...state, zoneAccess: items, zoneAccessStatus: 'loaded' as const })),
    on(ClientsActions.loadZoneAccessFailure, (state, { errorMessageKey }) => ({
      ...state, zoneAccessStatus: 'error' as const, zoneAccessErrorMessageKey: errorMessageKey,
    })),
    on(ClientsActions.loadAvailableZonesSuccess, (state, { items }) => ({ ...state, availableZones: items })),

    on(ClientsActions.grantZoneAccess, ClientsActions.revokeZoneAccess, (state) => ({
      ...state, zoneAccessErrorMessageKey: null,
    })),
    on(ClientsActions.grantZoneAccessSuccess, (state, { item }) => ({
      ...state, zoneAccess: [...state.zoneAccess, item],
    })),
    on(ClientsActions.revokeZoneAccessSuccess, (state, { item }) => ({
      ...state, zoneAccess: state.zoneAccess.map((za) => (za.id === item.id ? item : za)),
    })),
    on(ClientsActions.grantZoneAccessFailure, ClientsActions.revokeZoneAccessFailure, (state, { errorMessageKey }) => ({
      ...state, zoneAccessErrorMessageKey: errorMessageKey,
    })),

    on(ClientsActions.loadApiToken, (state) => ({ ...state, apiTokenStatus: 'loading' as const, apiTokenErrorMessageKey: null })),
    on(ClientsActions.loadApiTokenSuccess, (state, { item }) => ({ ...state, apiToken: item, apiTokenStatus: 'loaded' as const })),
    on(ClientsActions.loadApiTokenFailure, (state, { errorMessageKey }) => ({
      ...state, apiTokenStatus: 'error' as const, apiTokenErrorMessageKey: errorMessageKey,
    })),

    on(ClientsActions.regenerateApiToken, (state) => ({ ...state, isSavingToken: true, apiTokenErrorMessageKey: null })),
    on(ClientsActions.regenerateApiTokenSuccess, (state, { token, rawToken }) => ({
      ...state, apiToken: token, lastCreatedRawToken: rawToken, isSavingToken: false,
    })),
    on(ClientsActions.regenerateApiTokenFailure, (state, { errorMessageKey }) => ({
      ...state, isSavingToken: false, apiTokenErrorMessageKey: errorMessageKey,
    })),
    on(ClientsActions.clearLastCreatedToken, (state) => ({ ...state, lastCreatedRawToken: null })),

    on(ClientsActions.revokeApiToken, (state) => ({ ...state, isSavingToken: true, apiTokenErrorMessageKey: null })),
    on(ClientsActions.revokeApiTokenSuccess, (state) => ({ ...state, apiToken: null, isSavingToken: false })),
    on(ClientsActions.revokeApiTokenFailure, (state, { errorMessageKey }) => ({
      ...state, isSavingToken: false, apiTokenErrorMessageKey: errorMessageKey,
    })),
  ),
});

export const {
  name: clientsFeatureKey,
  reducer: clientsReducer,
  selectItems, selectListStatus, selectListErrorMessageKey, selectFilters,
  selectPlans,
  selectFormStatus, selectFormErrorMessageKey, selectLastCreatedTemporaryPassword,
  selectZoneAccess, selectZoneAccessStatus, selectAvailableZones, selectZoneAccessErrorMessageKey,
  selectApiToken, selectApiTokenStatus, selectIsSavingToken, selectApiTokenErrorMessageKey, selectLastCreatedRawToken,
} = clientsFeature;
