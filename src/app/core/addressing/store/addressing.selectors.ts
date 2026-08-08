import { createSelector } from '@ngrx/store';
import { addressingFeature } from './addressing.reducer';

export const selectIsBlocksLoading = createSelector(addressingFeature.selectBlocksStatus, (s) => s === 'loading');
export const selectIsStreetsLoading = createSelector(addressingFeature.selectStreetsStatus, (s) => s === 'loading');
export const selectIsPropertiesLoading = createSelector(addressingFeature.selectPropertiesStatus, (s) => s === 'loading');

export const selectIsSavingBlock = (id: string) =>
  createSelector(addressingFeature.selectSavingBlockId, (savingId) => savingId === id);
export const selectIsSavingStreet = (id: string) =>
  createSelector(addressingFeature.selectSavingStreetId, (savingId) => savingId === id);
export const selectIsSavingProperty = (id: string) =>
  createSelector(addressingFeature.selectSavingPropertyId, (savingId) => savingId === id);
