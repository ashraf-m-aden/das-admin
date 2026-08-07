import { createSelector } from '@ngrx/store';
import { clientsFeature } from './clients.reducer';

export const selectIsListLoading = createSelector(clientsFeature.selectListStatus, (s) => s === 'loading');
export const selectIsFormSaving = createSelector(clientsFeature.selectFormStatus, (s) => s === 'saving');
export const selectIsZoneAccessLoading = createSelector(clientsFeature.selectZoneAccessStatus, (s) => s === 'loading');
export const selectIsApiTokenLoading = createSelector(clientsFeature.selectApiTokenStatus, (s) => s === 'loading');

export const selectClientById = (id: string) =>
  createSelector(clientsFeature.selectItems, (items) => items.find((c) => c.id === id) ?? null);
